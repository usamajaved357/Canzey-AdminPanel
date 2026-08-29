-- Add Google and Apple to auth_method enum
ALTER TABLE customers
  MODIFY COLUMN auth_method ENUM('local', 'firebase', 'email', 'phone', 'google', 'apple') DEFAULT 'local';
