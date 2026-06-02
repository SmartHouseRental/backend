import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { engine } from 'express-handlebars';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { requireAuth, restrictTo } from './middlewares/auth.middleware';
import { resyncEmbeddingsController } from './modules/admin/embeddings.controller';

// Routes
import apiRoutes from './routes';

const app = express();

// Handlebars view engine setup
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
  })
);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://validator.swagger.io'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdnjs.cloudflare.com',
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      },
    },
  })
);
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS,
    credentials: true, // Allow cookies
  })
);
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(cookieParser());
app.use(morgan('dev'));
app.set('trust proxy', true);
// Swagger Documentation
app.get('/swagger.json', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(swaggerSpec);
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      filter: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: -1,
    },
  })
);

// Landing page route
app.get('/', (req, res) => {
  res.render('landing', { title: 'Home' });
});

// Global health route for uptime checks and landing page status badge
app.get('/health', (_, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    build: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || process.env.BUILD_ID || 'local',
  });
});

app.get('/api/v1/health/schema', async (_, res) => {
  try {
    const { Prisma } = await import('@prisma/client');
    const agreement = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Agreement');
    const payment = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Payment');
    const enums = Prisma.dmmf.datamodel.enums.map((e) => e.name);

    res.status(200).json({
      status: 'ok',
      prismaClient: {
        agreementFields: agreement?.fields.map((f) => f.name) ?? [],
        paymentFields: payment?.fields.map((f) => f.name) ?? [],
        enums,
        legacyPaymentStatusColumn:
          agreement?.fields.some((f) => f.name === 'paymentStatus') ?? false,
        legacyPaymentStatusEnum: enums.includes('PaymentStatus'),
      },
      build: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || process.env.BUILD_ID || 'local',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Schema check failed',
    });
  }
});

// API Routes
app.use('/api/v1', apiRoutes);

// Legacy alias (Swagger UI and older clients used /admin/... without /api/v1)
app.post(
  '/admin/embeddings/resync',
  requireAuth,
  restrictTo('admin'),
  resyncEmbeddingsController,
);

// Global Error Handler
app.use(errorHandler);

export default app;
