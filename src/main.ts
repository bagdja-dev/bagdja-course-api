import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

import { AppModule } from "./app.module";

function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function createSwaggerAuthMiddleware({
  username,
  password
}: {
  username: string;
  password: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? "";
    const [scheme, encoded] = header.split(" ");

    if (scheme !== "Basic" || !encoded) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Bagdja Swagger"');
      return res.status(401).send("Unauthorized");
    }

    let decoded = "";
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      res.setHeader("WWW-Authenticate", 'Basic realm="Bagdja Swagger"');
      return res.status(401).send("Unauthorized");
    }

    const sepIndex = decoded.indexOf(":");
    const user = sepIndex >= 0 ? decoded.slice(0, sepIndex) : "";
    const pass = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : "";

    if (!constantTimeEqual(user, username) || !constantTimeEqual(pass, password)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Bagdja Swagger"');
      return res.status(401).send("Unauthorized");
    }

    return next();
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: true,
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Bagdja Course API")
    .setDescription("Courses (online/offline) + eBooks + checkout (payment integration later).")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const swaggerUser = String(config.get("SWAGGER_USER") ?? "").trim();
  const swaggerPass = String(config.get("SWAGGER_PASSWORD") ?? "").trim();
  if (swaggerUser && swaggerPass) {
    app.use(
      ["/docs", "/docs-json"],
      createSwaggerAuthMiddleware({ username: swaggerUser, password: swaggerPass })
    );
  }

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = Number(config.get("PORT") ?? 3008);
  await app.listen(port);
}

void bootstrap();
