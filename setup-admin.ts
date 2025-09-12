import bcrypt from 'bcryptjs';
import { db } from './server/db';
import { users } from './shared/schema';

async function createAdminUser() {
  try {
    console.log('Creating default admin user...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123!', 10);
    
    // Create admin user
    const [user] = await db
      .insert(users)
      .values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      })
      .onConflictDoNothing() // Don't fail if user already exists
      .returning();
    
    if (user) {
      console.log('✅ Admin user created successfully');
      console.log('Username: admin');
      console.log('Password: admin123!');
    } else {
      console.log('ℹ️ Admin user already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();