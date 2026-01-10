import { AppDataSource } from '../data-source';
import { RoleSeed } from './role.seed';
import { writeRuntimeWarning } from '../utils/write-warning';
// futuros seeds:
// import { UserSeed } from './user.seed'

async function runSeeds() {
  await AppDataSource.initialize();

  const seeds = [
    new RoleSeed(),
    // new UserSeed(),
    // new AdminSeed(),
  ];

  for (const seed of seeds) {
    await seed.run(AppDataSource);
  }

  await AppDataSource.destroy();
  console.log('🌱 Todos los seeds ejecutados');
}

runSeeds().catch(async (err) => {
  console.error('❌ Error ejecutando seeds', err);

  writeRuntimeWarning(
    'Seed runner failed',
    err instanceof Error ? err.stack : String(err),
  );

  if (AppDataSource.isInitialized) {
    try {
      await AppDataSource.destroy();
    } catch (closeErr) {
      writeRuntimeWarning(
        'Error cerrando DataSource luego de fallo en seed',
        closeErr instanceof Error ? closeErr.stack : String(closeErr),
      );
    }
  }

  process.exit(1);
});
