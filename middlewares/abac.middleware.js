const User = require("../models/user.model");
const Patient = require("../models/patient.model");
const createTenantDB = require("../utils/createTenantDB");
const Hospital = require("../models/hospital.model");
const mongoose = require("mongoose");

/**
 * Attribute-Based Access Control (ABAC) Middleware
 * Filters data based on user attributes (department, specialization, shift)
 * and resource attributes (patient_department, confidentiality_level)
 * 
 * Usage:
 * - abac('PATIENT:READ') - Filter patients by department
 * - abac('PRESCRIPTION:READ') - Filter prescriptions by doctor
 */
module.exports = function (resource, action) {
  return async (req, res, next) => {
    try {
      // Skip ABAC for SUPER_ADMIN (has ALL:ALL permission)
      if (req.user && req.user.roleObjects) {
        const roleNames = req.user.roleObjects.map(r => r.name);
        if (roleNames.includes('SUPER_ADMIN')) {
          return next();
        }
      }

      // Load user attributes from database
      let user = null;
      let userAttributes = {
        department: null,
        specialization: null,
        shift: null
      };

      if (req.user && req.user.id) {
        // Try to get user from tenant database first
        if (req.user.hospitalId) {
          try {
            const hospital = await Hospital.findById(req.user.hospitalId).select("tenantId");
            if (hospital && hospital.tenantId) {
              const tenantConnection = await createTenantDB(hospital.tenantId);
              const TenantUser = tenantConnection.model("User");
              user = await TenantUser.findById(req.user.id).select("department specialization shift");
            }
          } catch (err) {
            console.error('Error loading tenant user for ABAC:', err);
          }
        }

        // Fallback to main database
        if (!user) {
          user = await User.findById(req.user.id).select("department specialization shift");
        }

        if (user) {
          userAttributes = {
            department: user.department || null,
            specialization: user.specialization || null,
            shift: user.shift || null
          };
        }
      }

      // Store user attributes in request for use in controllers
      req.userAttributes = userAttributes;

      // Apply ABAC filtering based on resource and action
      if (resource === 'PATIENT' && action === 'READ') {
        // For doctors: show patients assigned to them OR in their department
        if (req.user && req.user.id) {
          const roleNames = req.user.roleObjects?.map(r => r.name) || [];
          if (roleNames.includes('DOCTOR')) {
            // Doctors can see patients assigned to them OR in their department
            // Convert user.id to ObjectId if it's a string
            let doctorId = req.user.id;
            if (typeof doctorId === 'string' && mongoose.Types.ObjectId.isValid(doctorId)) {
              doctorId = new mongoose.Types.ObjectId(doctorId);
            }
            const orConditions = [{ assignedDoctor: doctorId }];
            if (userAttributes.department) {
              orConditions.push({ department: userAttributes.department });
            }
            req.abacFilter = { $or: orConditions };
          } else if (roleNames.includes('NURSE')) {
            // Nurses can see patients assigned to them OR in their department
            // Convert user.id to ObjectId if it's a string
            let nurseId = req.user.id;
            if (typeof nurseId === 'string' && mongoose.Types.ObjectId.isValid(nurseId)) {
              nurseId = new mongoose.Types.ObjectId(nurseId);
            }
            const orConditions = [{ assignedNurse: nurseId }];
            if (userAttributes.department) {
              orConditions.push({ department: userAttributes.department });
            }
            req.abacFilter = { $or: orConditions };
            console.log('🔍 ABAC filter for NURSE:', JSON.stringify(req.abacFilter, null, 2));
            console.log('🔍 Nurse ID:', nurseId?.toString(), 'Type:', typeof nurseId);
          } else if (userAttributes.department) {
            // Other roles filter by department
            req.abacFilter = { department: userAttributes.department };
          }
        }
      }

      if (resource === 'PRESCRIPTION' && action === 'READ') {
        // Doctors can only view their own prescriptions
        if (req.user && req.user.id) {
          req.abacFilter = { doctor: req.user.id };
        }
      }

      if (resource === 'VITAL' && action === 'READ') {
        // Check if user is a doctor or nurse
        const roleNames = req.user.roleObjects?.map(r => r.name) || [];
        if (roleNames.includes('DOCTOR')) {
          // Doctors can see vitals for patients assigned to them
          const assignedPatientIds = await getPatientIdsByAssignedDoctor(req.user.id, req.user.hospitalId);
          if (assignedPatientIds.length > 0) {
            req.abacFilter = { patient: { $in: assignedPatientIds } };
          } else {
            // No assigned patients, return empty result
            req.abacFilter = { patient: { $in: [] } };
          }
        } else if (roleNames.includes('NURSE')) {
          // Nurses can see vitals for patients assigned to them OR in their department
          const assignedPatientIds = await getPatientIdsByAssignedNurse(req.user.id, req.user.hospitalId);
          let allPatientIds = [...assignedPatientIds];
          
          if (userAttributes.department) {
            const departmentPatientIds = await getPatientIdsByDepartment(userAttributes.department, req.user.hospitalId);
            // Combine and deduplicate
            allPatientIds = [...new Set([...allPatientIds, ...departmentPatientIds].map(id => id.toString()))];
          }
          
          if (allPatientIds.length > 0) {
            req.abacFilter = { patient: { $in: allPatientIds } };
          } else {
            // No assigned patients, return empty result
            req.abacFilter = { patient: { $in: [] } };
          }
        } else if (userAttributes.department) {
          // Other roles filter by department
          const patientIds = await getPatientIdsByDepartment(userAttributes.department, req.user.hospitalId);
          if (patientIds.length > 0) {
            req.abacFilter = { patient: { $in: patientIds } };
          } else {
            // No patients in department, return empty result
            req.abacFilter = { patient: { $in: [] } };
          }
        }
      }

      next();
    } catch (error) {
      console.error('ABAC middleware error:', error);
      // Don't block request if ABAC fails, just log error
      next();
    }
  };
};

/**
 * Helper function to get patient IDs by department
 */
async function getPatientIdsByDepartment(department, hospitalId) {
  try {
    const query = { department, hospitalId };
    const patients = await Patient.find(query).select("_id");
    return patients.map(p => p._id);
  } catch (error) {
    console.error('Error getting patient IDs by department:', error);
    return [];
  }
}

/**
 * Helper function to get patient IDs assigned to a doctor
 */
async function getPatientIdsByAssignedDoctor(doctorId, hospitalId) {
  try {
    const query = { assignedDoctor: doctorId, hospitalId };
    const patients = await Patient.find(query).select("_id");
    return patients.map(p => p._id);
  } catch (error) {
    console.error('Error getting patient IDs by assigned doctor:', error);
    return [];
  }
}

/**
 * Helper function to get patient IDs assigned to a nurse
 */
async function getPatientIdsByAssignedNurse(nurseId, hospitalId) {
  try {
    const query = { assignedNurse: nurseId, hospitalId };
    const patients = await Patient.find(query).select("_id");
    return patients.map(p => p._id);
  } catch (error) {
    console.error('Error getting patient IDs by assigned nurse:', error);
    return [];
  }
}
