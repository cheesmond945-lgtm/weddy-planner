import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';

/** Yêu thích: đơn vị là nhà cung cấp (serviceId của frontend = vendor_profiles.id). */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService, private readonly services: ServicesService) {}

  async list(userId: string) {
    const rows = await this.prisma.favorite_vendors.findMany({ where: { user_id: userId }, orderBy: [{ created_date: 'asc' }, { vendor_id: 'asc' }] });
    const byId = new Map((await this.services.summaries(rows.map((r) => r.vendor_id))).map((s) => [s.id, s]));
    return rows.map((r) => byId.get(r.vendor_id)).filter((s) => !!s);
  }

  async add(userId: string, serviceId: string) {
    if (!(await this.services.isVisible(serviceId))) throw new HttpException({ code: 'SERVICE_NOT_FOUND', message: 'Không tìm thấy dịch vụ.' }, 404);
    await this.prisma.favorite_vendors.createMany({ data: [{ user_id: userId, vendor_id: serviceId }], skipDuplicates: true });
    return null;
  }

  async remove(userId: string, serviceId: string) {
    await this.prisma.favorite_vendors.deleteMany({ where: { user_id: userId, vendor_id: serviceId } });
    return null;
  }
}
