import { User } from '../models/User';

export async function seedDefaultUser(): Promise<void> {
  try {
    const defaultEmail = 'lead@apisentinel.local';
    const existing = await User.findOne({
      $or: [{ email: defaultEmail }, { username: 'security_lead' }]
    });

    if (!existing) {
      const defaultUser = new User({
        username: 'security_lead',
        email: defaultEmail,
        password: 'SuperSecurePassword2026!',
        role: 'admin'
      });
      await defaultUser.save();
      console.log(`[Database] Seeded default demo user: ${defaultEmail} / SuperSecurePassword2026!`);
    }
  } catch (err: any) {
    console.warn('[Database] Seed default user warning:', err.message);
  }
}
