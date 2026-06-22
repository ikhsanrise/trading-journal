import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('trading123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'ikhsan@gmail.com' },
    update: { password: hashed },
    create: {
      email: 'ikhsan@gmail.com',
      name: 'Ikhsan',
      password: hashed,
    },
  });
  console.log('User berhasil:', user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
