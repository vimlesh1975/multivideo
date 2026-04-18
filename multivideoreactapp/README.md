# Multivideo React App

A CasparCG controller decoupled into a React frontend and Node.js backend. This project replaces a monolith Next.js application, providing a separate local Express server for AMCP communication and media tree exploration, along with a dedicated Create React App client.

## Project Structure

- **`client/`**: React frontend (Port 3000)
- **`server/`**: Node.js + Express backend (Port 3001)

## Getting Started

### Installation

From the root `multivideoreactapp` directory, run the following command to install dependencies for the root, client, and server:

```bash
npm run install:all
```

### Running the Application

To start both the backend server and frontend client simultaneously, run:

```bash
npm run dev
```

- The React app will open at `http://localhost:3000`
- The Express server acts as an API gateway for CasparCG at `http://localhost:3001`

### Environment Variables

If needed, you can declare standard CasparCG configurations using an `.env` file within the `server/` directory:

- `PORT` (Default: 3001)
- `CASPARCG_HOST` (Default: 127.0.0.1)
- `CASPARCG_PORT` (Default: 5250)
