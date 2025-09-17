import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './server/db';
import { users } from './shared/schema';

async function createAdminUser() {
  try {
    console.log('Creating default admin user...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Database URL configured:', !!process.env.DATABASE_URL);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('password', 10);
    
    // Create admin user with explicit conflict handling
    const [user] = await db
      .insert(users)
      .values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          password: hashedPassword,
          role: 'admin'
        }
      })
      .returning();
    
    if (user) {
      console.log('✅ Admin user created/updated successfully');
      console.log('Username: admin');
      console.log('Password: password');
      console.log('User ID:', user.id);
    } else {
      console.log('⚠️ Failed to create/update admin user');
    }
    
    // Verify the user exists by querying  
    const existingUsers = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
    if (existingUsers.length > 0) {
      console.log('✅ Admin user verified in database');
    } else {
      console.log('❌ Admin user not found after creation');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();