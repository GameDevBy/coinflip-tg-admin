# Deploy Admin Client To GitHub Pages (Prod + Dev)

## Branch mapping

- `main` -> production Pages deployment (workflow: `deploy-pages.yml`)
- `dev-client` -> dev build deployed to `gh-pages` branch under `/dev` (workflow: `deploy-pages-dev.yml`)

## Required secrets

Production:

- `REACT_APP_SERVER_HOST`

Development:

- `REACT_APP_SERVER_HOST_DEV`

## Local env files

- `coinflip-tg-admin/.env.production`
- `coinflip-tg-admin/.env.development`

## Notes

- App URLs:
- prod: `https://gamedevby.github.io/coinflip-tg-admin/`
- dev: `https://gamedevby.github.io/coinflip-tg-admin/dev/`
