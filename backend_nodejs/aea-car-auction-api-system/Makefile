.PHONY: dev-up dev-down dev-logs prod-pull prod-up prod-down prod-logs config

dev-up:
	./scripts/compose.sh dev up -d --build

dev-down:
	./scripts/compose.sh dev down

dev-logs:
	./scripts/compose.sh dev logs -f --tail=200

prod-pull:
	./scripts/compose.sh prod pull

prod-up:
	./scripts/compose.sh prod up -d --remove-orphans

prod-down:
	./scripts/compose.sh prod down

prod-logs:
	./scripts/compose.sh prod logs -f --tail=200

config:
	./scripts/compose.sh prod config
