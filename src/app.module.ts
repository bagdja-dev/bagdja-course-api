import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./common/auth/auth.module";
import { SupabaseModule } from "./common/supabase/supabase.module";
import { AdminAuthFeatureModule } from "./modules/admin-auth/admin-auth.module";
import { AdminModule } from "./modules/admin/admin.module";
import { BooksModule } from "./modules/books/books.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { CoursesModule } from "./modules/courses/courses.module";
import { EventsModule } from "./modules/events/events.module";
import { HealthModule } from "./modules/health/health.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { OrdersModule } from "./modules/orders/orders.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    AdminAuthFeatureModule,
    AdminModule,
    HealthModule,
    CoursesModule,
    EventsModule,
    BooksModule,
    LocationsModule,
    CheckoutModule,
    OrdersModule
  ]
})
export class AppModule {}
