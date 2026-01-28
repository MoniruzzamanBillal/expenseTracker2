import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  //

  // ! for creating new product
  async addProduct(payload: CreateProductDto, imageUrl: string) {
    const result = await this.prisma.product.create({
      data: { ...payload, imageUrl },
    });

    return result;
  }

  // ! for getting all product
  async getAllProduct() {
    const result = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return result;
  }

  // ! for getting single product data
  async getSingleProduct(productId: string) {
    const result = await this.prisma.product.findFirst({
      where: { id: productId },
    });

    if (!result) {
      throw new NotFoundException("This Product don't exist!!!");
    }

    return result;
  }

  //
}
