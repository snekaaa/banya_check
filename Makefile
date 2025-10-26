.PHONY: help up down restart logs build clean dev

help: ## Показать эту справку
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Запустить все сервисы
	docker-compose up -d

down: ## Остановить все сервисы
	docker-compose down

restart: ## Перезапустить все сервисы
	docker-compose restart

logs: ## Показать логи всех сервисов
	docker-compose logs -f

logs-bot: ## Показать логи бота
	docker-compose logs -f bot

logs-app: ## Показать логи приложения
	docker-compose logs -f app

logs-db: ## Показать логи базы данных
	docker-compose logs -f postgres

build: ## Пересобрать образы
	docker-compose build

rebuild: ## Пересобрать и запустить
	docker-compose up --build -d

clean: ## Остановить и удалить все контейнеры и volumes
	docker-compose down -v

dev: ## Запустить только PostgreSQL для локальной разработки
	docker-compose up postgres -d

ps: ## Показать статус сервисов
	docker-compose ps

prisma-migrate: ## Применить миграции Prisma
	docker-compose exec bot npx prisma migrate deploy

prisma-studio: ## Открыть Prisma Studio
	docker-compose exec bot npx prisma studio

db-shell: ## Подключиться к PostgreSQL
	docker-compose exec postgres psql -U banya_user -d banya_db

setup: ## Первоначальная настройка проекта
	@echo "Копирование .env.example в .env..."
	@cp -n .env.example .env || true
	@echo "Готово! Отредактируйте .env и запустите 'make up'"
