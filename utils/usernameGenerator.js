/**
 * Generate username based on firstName, lastName, and hospital domain
 * Format: {firstName}.{lastName}@{hospitalDomain}
 */
exports.generateUsername = (firstName, lastName, hospitalEmail) => {
  // Extract domain from hospital email or use default
  const domain = hospitalEmail ? hospitalEmail.split("@")[1] : "hospital.com";
  
  // Clean names: lowercase, remove spaces and special chars
  const cleanFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanLastName = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // Generate base username
  const baseUsername = `${cleanFirstName}.${cleanLastName}@${domain}`;
  
  return baseUsername;
};

/**
 * Generate unique username if collision occurs
 * Format: {firstName}.{lastName}{number}@{hospitalDomain}
 */
exports.generateUniqueUsername = async (UserModel, firstName, lastName, hospitalEmail, maxAttempts = 100) => {
  const baseUsername = exports.generateUsername(firstName, lastName, hospitalEmail);
  
  // Check if base username exists
  let existing = await UserModel.findOne({ 
    $or: [
      { username: baseUsername },
      { email: baseUsername }
    ]
  });
  
  if (!existing) {
    return baseUsername;
  }
  
  // Try with numbers
  for (let i = 1; i <= maxAttempts; i++) {
    const username = `${baseUsername.split("@")[0]}${i}@${baseUsername.split("@")[1]}`;
    existing = await UserModel.findOne({ 
      $or: [
        { username },
        { email: username }
      ]
    });
    
    if (!existing) {
      return username;
    }
  }
  
  // Fallback: use timestamp
  const timestamp = Date.now();
  return `${baseUsername.split("@")[0]}${timestamp}@${baseUsername.split("@")[1]}`;
};

