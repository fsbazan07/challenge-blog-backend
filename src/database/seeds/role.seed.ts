import { DataSource } from 'typeorm';
import { Role } from '../../users/entities/role.entity';

export class RoleSeed {
  async run(dataSource: DataSource) {
    const repo = dataSource.getRepository(Role);

    const roles = [
      { code: 'ADMIN', name: 'administrador' },
      { code: 'BLOGGER', name: 'blogger' },
    ];

    for (const r of roles) {
      const exists = await repo.findOne({ where: { code: r.code } });
      if (!exists) await repo.save(repo.create(r));
    }

    console.log('✅ Roles seeded');
  }
}
