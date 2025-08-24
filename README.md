
# n8n Collaboration Backend

A real-time collaboration backend service for n8n workflows, providing WebSocket-based communication for collaborative workflow editing and execution.

## Features

- **Real-time Collaboration**: WebSocket-based real-time communication for multiple users
- **Workflow Synchronization**: Live synchronization of workflow changes across connected clients
- **User Presence**: Track and display active users in workflows
- **Conflict Resolution**: Handle concurrent edits and maintain workflow integrity
- **Scalable Architecture**: Built with Node.js and Socket.IO for high performance
- **Production Ready**: Docker containerized with comprehensive monitoring and logging

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (for containerized deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/n8n-collaboration-backend.git
   cd n8n-collaboration-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000` with WebSocket support on port `3001`.

### Docker Deployment

1. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **For production deployment**
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

## API Documentation

### REST Endpoints

- `GET /health` - Health check endpoint
- `GET /status` - Application status and version info
- `GET /metrics` - Application metrics and performance data
- `GET /ws-health` - WebSocket connection health check

### WebSocket Events

#### Client to Server Events

- `join-workflow` - Join a workflow collaboration session
- `leave-workflow` - Leave a workflow collaboration session
- `workflow-update` - Send workflow changes to other collaborators
- `cursor-position` - Share cursor position with other users
- `user-selection` - Share selected nodes/elements

#### Server to Client Events

- `user-joined` - Notify when a user joins the workflow
- `user-left` - Notify when a user leaves the workflow
- `workflow-updated` - Receive workflow changes from other users
- `cursor-moved` - Receive cursor position updates
- `selection-changed` - Receive selection updates from other users
- `conflict-detected` - Notify about conflicting changes

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP server port | `3000` | No |
| `WS_PORT` | WebSocket server port | `3001` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `WS_HOST` | WebSocket host | `0.0.0.0` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `CORS_ORIGIN` | CORS allowed origins | `*` | No |
| `JWT_SECRET` | JWT signing secret | - | Yes (production) |
| `LOG_LEVEL` | Logging level | `info` | No |
| `LOG_FILE` | Log file path | `logs/app.log` | No |

### Production Configuration

For production deployments, ensure you set:

- `NODE_ENV=production`
- `JWT_SECRET` to a secure random string
- `CORS_ORIGIN` to your frontend domain
- Proper logging configuration
- SSL/TLS certificates for secure WebSocket connections

## Deployment

### Oracle Cloud + Coolify

This project includes comprehensive deployment configuration for Oracle Cloud Infrastructure using Coolify. See the [deployment guide](docs/ORACLE_CLOUD_COOLIFY_DEPLOYMENT.md) for detailed instructions.

Key deployment features:
- Automated SSL certificate management
- WebSocket support with proper proxy configuration
- Environment variable management
- Health checks and monitoring
- Automated backups and maintenance

### GitHub Actions CI/CD

The repository includes GitHub Actions workflows for:
- Automated testing on pull requests
- Code quality checks and linting
- Automated deployment to Coolify on main branch pushes
- Security scanning and dependency updates

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   n8n Frontend  │    │   n8n Frontend  │    │   n8n Frontend  │
│     (User A)    │    │     (User B)    │    │     (User C)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │   Collaboration Backend   │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   WebSocket Server  │  │
                    │  │   (Socket.IO)       │  │
                    │  └─────────────────────┘  │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   REST API Server   │  │
                    │  │   (Express.js)      │  │
                    │  └─────────────────────┘  │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │  Collaboration      │  │
                    │  │  Logic & State      │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
```

## Development

### Project Structure

```
src/
├── server.js              # Main application entry point
├── websocket/             # WebSocket handling
│   ├── handlers/          # Event handlers
│   ├── middleware/        # WebSocket middleware
│   └── utils/             # WebSocket utilities
├── routes/                # REST API routes
├── middleware/            # Express middleware
├── utils/                 # Utility functions
├── config/                # Configuration files
└── tests/                 # Test files
```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run build` - Build for production (if applicable)

### Testing

The project uses Jest for testing with the following test categories:

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test API endpoints and WebSocket events
- **E2E Tests**: Test complete user workflows

Run tests with:
```bash
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only
npm run test:e2e          # Run end-to-end tests
```

### Code Quality

The project enforces code quality through:

- **ESLint**: JavaScript linting with Airbnb configuration
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit checks
- **Jest**: Test coverage reporting

## Monitoring and Logging

### Health Checks

The application provides several health check endpoints:

- `/health` - Basic application health
- `/ws-health` - WebSocket connection status
- `/metrics` - Detailed application metrics

### Logging

Structured logging using Winston with:

- Console output for development
- File output for production
- JSON format for log aggregation
- Configurable log levels

### Monitoring

Production deployments include:

- Application performance monitoring
- WebSocket connection tracking
- Error tracking and alerting
- Resource usage monitoring

## Security

### Security Features

- **CORS Protection**: Configurable CORS origins
- **Rate Limiting**: Prevent abuse of API endpoints
- **Input Validation**: Validate all incoming data
- **JWT Authentication**: Secure user authentication (when enabled)
- **WebSocket Security**: Secure WebSocket connections with authentication

### Security Best Practices

- Use HTTPS/WSS in production
- Set strong JWT secrets
- Configure proper CORS origins
- Regular security updates
- Monitor for suspicious activity

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR
- Use conventional commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/n8n-collaboration-backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/n8n-collaboration-backend/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.

---

Built with ❤️ for the n8n community
