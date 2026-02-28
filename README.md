# envault

Encrypt `.env` files so they can be safely committed to git. Dead simple. Zero dependencies.

## Why

- `.env` files contain secrets
- You can't commit them to git
- But you need to share them with your team
- **envault** encrypts them with AES-256-GCM so you can commit the encrypted version

## Install

```bash
npm install -g @quinnod345/envault --registry=https://npm.pkg.github.com
```

## Usage

```bash
# Set your password
export ENVAULT_PASSWORD="your-team-password"

# Set up gitignore
envault init

# Encrypt your .env
envault lock

# Decrypt it back  
envault unlock

# View decrypted contents without writing to disk
envault diff

# Works with any .env file
envault lock .env.production
envault unlock .env.staging
```

## Security

- AES-256-GCM encryption
- PBKDF2 key derivation (100k iterations, SHA-512)
- Random salt + IV per encryption
- Zero dependencies — only Node.js built-in crypto

## License

MIT
