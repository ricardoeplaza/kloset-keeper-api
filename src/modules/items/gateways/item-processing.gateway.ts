import { ConfigService } from '@nestjs/config';
import { Logger, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

/**
 * DTO para el evento de procesamiento completado
 */
export interface ItemProcessedEvent {
  itemId: string;
  status: 'ready' | 'failed';
  name?: string;
  category?: string;
  color_palette?: { group: string; hex: string; percentage: number }[];
  embeddingModel?: string;
}

/**
 * Gateway WebSocket para notificaciones de procesamiento de items
 *
 * Namespace: /items
 * Auth: JWT via socket.handshake.auth.token
 * Rooms: user:${userId} (aislamiento por usuario)
 *
 * USAGE (Backend):
 *   this.itemGateway.emitToUser(userId, 'item:processed', { itemId, status: 'ready' })
 *
 * USAGE (Frontend):
 *   socket = io('/items', { auth: { token: 'jwt_token' } })
 *   socket.on('item:processed', (data) => console.log(data))
 */
@WebSocketGateway({
  namespace: 'items',
  cors: {
    origin: (req, callback) => {
      const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
      callback(null, allowedOrigin);
    },
  },
})
export class ItemProcessingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ItemProcessingGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Valida el JWT del handshake y une al socket a la room del usuario
   */
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token as string;

      if (!token) {
        throw new UnauthorizedException('Token not provided');
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      const userId = payload.sub;

      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Unir al socket a una room privada del usuario
      const roomName = `user:${userId}`;
      await client.join(roomName);

      this.logger.debug(`Client ${client.id} joined room ${roomName}`);
    } catch (error) {
      this.logger.warn(`Connection rejected for ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Limpieza al desconectar
   */
  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  /**
   * Emite un evento a la room privada de un usuario específico
   * Usado por los processors de BullMQ para notificar al frontend
   */
  emitToUser(userId: string, event: string, data: ItemProcessedEvent) {
    const roomName = `user:${userId}`;
    this.server.to(roomName).emit(event, data);
    this.logger.debug(`Emitted ${event} to ${roomName} for item ${data.itemId}`);
  }

  /**
   * Handler de heartbeat para mantener la conexión viva
   * El frontend puede emitir 'ping' periódicamente
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }
}
