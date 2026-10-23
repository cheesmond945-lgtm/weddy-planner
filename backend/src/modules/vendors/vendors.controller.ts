import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  // GET /api/vendors/:id/documents — Admin hoặc chính NCC đó; trả link xem tạm thời (10 phút)
  @UseGuards(JwtAuthGuard)
  @Roles('Admin', 'Vendor')
  @Get(':id/documents')
  async documents(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const vendor = await this.prisma.vendor_profiles.findUnique({ where: { id }, select: { id: true, user_id: true } });
    if (!vendor) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    if (req.user.role === 'Vendor' && vendor.user_id !== req.user.sub) throw new ForbiddenException();

    const docs = await this.prisma.vendor_documents.findMany({
      where: { vendor_id: id },
      orderBy: [{ document_type: 'asc' }, { display_order: 'asc' }],
    });
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        type: d.document_type,
        url: await this.storage.signedDocumentUrl(d.url),
      })),
    );
  }
}
