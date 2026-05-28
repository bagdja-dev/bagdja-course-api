import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BagdjaModule } from "@bagdja/node-sdk";

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
import { PaymentModule } from "./modules/payment/payment.module";
import { UsersModule } from "./modules/users/users.module";
import { MessagingModule } from "./modules/users/messaging.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BagdjaModule.register({
      isGlobal: true,
      auth: {
        authServiceUrl:
          process.env.BAGDJA_AUTH_API ||
          process.env.BAGDJA_AUTH_URL ||
          "https://auth.bagdja.com",
      },
      logger: {
        logServiceUrl:
          process.env.BAGDJA_LOG_URL ||
          process.env.LOG_SERVICE_URL ||
          "http://localhost:4087",
        serviceName: process.env.BAGDJA_SERVICE_NAME || "bagdja-course-api",
        apiKey: process.env.BAGDJA_INTERNAL_API_KEY,
      },
    }),
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
    OrdersModule,
    PaymentModule,
    UsersModule,
    MessagingModule
  ]
})
export class AppModule {}
