import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BagdjaLogger } from "@bagdja/node-sdk";

@Injectable()
export class MessagingService {
  private readonly apiUrl: string;
  private readonly authApiUrl: string;
  private readonly clientAppId: string;
  private readonly clientAppSecret: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService, private readonly logger: BagdjaLogger) {
    const defaultAppId = this.config.get<string>("CLIENT_APP_ID") || "books-and-course-store";
    const defaultOrgId = this.config.get<string>("BAGDJA_ORG_ID") || "system";
    this.logger.init(defaultAppId, defaultOrgId);
    this.apiUrl = this.config.get<string>("BAGDJA_MESSAGE_API") || "https://message.bagdja.com";
    this.authApiUrl = this.config.get<string>("BAGDJA_AUTH_API") || "https://auth.bagdja.com";
    this.clientAppId = this.config.get<string>("CLIENT_APP_ID") || "";
    this.clientAppSecret = this.config.get<string>("CLIENT_APP_SECRET") || "";
  }

  private async getAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.token;
    }

    if (!this.clientAppId || !this.clientAppSecret) {
      throw new Error("CLIENT_APP_ID or CLIENT_APP_SECRET is not configured");
    }

    const url = `${this.authApiUrl.replace(/\/$/, "")}/auth/client`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: this.clientAppId,
        app_secret: this.clientAppSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get auth token: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { "x-api-token": string; expires_in?: number };
    const token = data["x-api-token"];
    const expiresIn = data.expires_in || 3600;

    this.tokenCache = {
      token,
      expiresAt: now + expiresIn * 1000,
    };

    return token;
  }

  async sendEmail(to: string, template: string, context: any, appId?: string) {
    try {
      const token = await this.getAuthToken();
      const url = `${this.apiUrl.replace(/\/$/, "")}/messages/email/send`;
      
      this.logger.bagdjaLog('info', 'Sending email request', {
        data: { to, template, appId, url },
      });
      
      const payload: any = { to, template, context };
      if (appId) payload.appId = appId;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": token,
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      this.logger.bagdjaLog('debug', 'Messaging API response received', {
        data: { status: response.status, statusText: response.statusText, body: rawText },
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = rawText ? JSON.parse(rawText) : {};
        } catch {
          errorData = { message: rawText };
        }
        this.logger.bagdjaLog('error', 'Messaging API Error Response', {
          data: { errorData, status: response.status },
        });
        throw new Error(errorData.message || `Messaging API Error: ${response.statusText}`);
      }

      const result = rawText ? JSON.parse(rawText) : {};
      this.logger.bagdjaLog('info', 'Messaging API request succeeded', {
        data: result,
      });
      return result;
    } catch (err) {
      this.logger.bagdjaLog('error', 'MessagingService caught error', {
        data: { error: err instanceof Error ? err.message : err },
      });
      throw new InternalServerErrorException(err instanceof Error ? err.message : "Unknown error in messaging");
    }
  }
}
