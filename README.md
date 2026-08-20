<div align="center" style="background: #fcfff7; padding: 2rem 1rem; border-radius: 16px;">
  <h1 style="font-family: Poppins, sans-serif; color: #b31b1b; font-weight: 800; font-size: 2.5rem; margin: 0.5rem 0;">
    Velocitapp
  </h1>

  <p style="font-family: Roboto, sans-serif; color: #555; font-size: 1rem; max-width: 480px; margin: 0.5rem auto;">
    All-in-one web app for teams — room booking, essay bank, and authentication.
  </p>

  <p style="font-family: Roboto, sans-serif; color: #2c1a1d; font-size: 0.85rem; margin-top: 1.5rem;">
    Made with ❤️ by
    <a href="https://www.linkedin.com/in/tomprotiva/" style="color: #b31b1b; text-decoration: none;">Tomáš Protiva</a>
  </p>
</div>

# Links

## Publicly available

- [Velocitapp](https://app.velocity.ooo)

## Locally available when running the project

- [Velocitapp locally](http://localhost:3000)
- [Supabase locally](http://localhost:54323)
- [Supabase mail locally](http://localhost:54324)

## Other links

- [Blacksmith](https://app.blacksmith.sh/) - CI/CD for the project
- [Supabase](https://supabase.com/org/zjdqjjekgwwysjkouxpf) - Database for the project
- [Vercel](https://vercel.com/spirit-of-taps-projects/velocitapp) - Hosting for the project
- [Cloudflare DNS](https://dash.cloudflare.com/09d0b565479ef597d4c1bfa2062078b5/tiimi.cz/dns/records) - DNS for the project

# Language

The project is written in english and will be written in english for better llm compatibility.
All czech should be just in localization files.

# Local Development

## Setup

1. Install git if already not installed - https://git-scm.com/install/

```powershell
winget install -e --id Git.Git
```

```bash
brew install git
```

2. Install mise if already not installed - https://mise.jdx.dev/installing-mise.html

MACOS

```bash
curl https://mise.run/zsh | sh
```

WINDOWS

```powershell
winget install jdx.mise
```

3. Setup mise - https://mise.jdx.dev/getting-started.html

```bash
mise install
mise doctor
```

4. On MACOS docker gets installed automatically by mise. On Windows you need to install it manually - https://docs.docker.com/get-docker/

```powershell
winget install -e --id Docker.DockerDesktop
```

5. Clone the repository

```bash
git clone https://github.com/tomapli/velocity.app.git
```

6. Navigate to the project directory -

```bash
cd velocitapp
```

## Running the project after setup

```bash
pnpm install
pnpm dev
```

The project will be available at [http://localhost:3000](http://localhost:3000)

Other commands:

```bash
pnpm dev # Runs the project in development mode. Starts the supabase docker instance (which will not turn off even when you ctrl+c)
pnpm stop # Stops the supabase docker instance
pnpm restart # Stops the supabase docker instance and runs dev again
```

To see how to develop the project see [CONTRIBUTING.md](CONTRIBUTING.md). Will make it easier to do stuff like add new migrations, add new features, etc.
