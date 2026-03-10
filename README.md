
cd sharedfinance-mobile
npm install
npx expo start



Estructura 
├── 📁 auth-service
│   ├── 📁 config
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 asgi.py
│   │   ├── 🐍 settings.py
│   │   ├── 🐍 urls.py
│   │   └── 🐍 wsgi.py
│   ├── 📁 sharedfinance_auth
│   │   ├── 📁 migrations
│   │   │   ├── 🐍 0001_initial.py
│   │   │   ├── 🐍 0002_sharedworkspace_invitation_code.py
│   │   │   └── 🐍 __init__.py
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 admin.py
│   │   ├── 🐍 apps.py
│   │   ├── 🐍 models.py
│   │   ├── 🐍 serializers.py
│   │   ├── 🐍 urls.py
│   │   └── 🐍 views.py
│   ├── 🐳 Dockerfile
│   └── 🐍 manage.py
├── 📁 finance-service
│   ├── 📁 config
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 asgi.py
│   │   ├── 🐍 settings.py
│   │   ├── 🐍 urls.py
│   │   └── 🐍 wsgi.py
│   ├── 📁 sharedfinance_finance
│   │   ├── 📁 migrations
│   │   │   ├── 🐍 0001_initial.py
│   │   │   ├── 🐍 0002_monthlybudget_budgetcategory_and_more.py
│   │   │   ├── 🐍 0003_savingsgoal_created_by_user_email_and_more.py
│   │   │   ├── 🐍 0004_monthlybudget_is_shared_and_more.py
│   │   │   ├── 🐍 0005_whatsappuser.py
│   │   │   └── 🐍 __init__.py
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 admin.py
│   │   ├── 🐍 apps.py
│   │   ├── 🐍 models.py
│   │   ├── 🐍 serializers.py
│   │   ├── 🐍 urls.py
│   │   └── 🐍 views.py
│   ├── 🐳 Dockerfile
│   ├── 🐍 add_test_whatsapp_user.py
│   ├── 🐍 manage.py
│   └── 🐍 register_whatsapp_user.py
├── 📁 nanobot-service
│   ├── 📁 skills
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 consultar_balance.py
│   │   └── 🐍 registrar_gasto.py
│   ├── 📝 BOT_ENDPOINT_DOCS.md
│   ├── 🐳 Dockerfile
│   ├── 📄 entrypoint.sh
│   ├── ⚙️ package.json
│   └── 📄 whatsapp-bridge.js
├── 📁 sharedfinance-mobile
│   ├── 📁 src
│   │   ├── 📁 components
│   │   ├── 📁 context
│   │   │   └── 📄 AuthContext.js
│   │   ├── 📁 navigation
│   │   │   └── 📄 RootNavigator.js
│   │   ├── 📁 screens
│   │   │   ├── 📄 DashboardScreen.js
│   │   │   ├── 📄 ExpenseHistoryScreen.js
│   │   │   ├── 📄 LoginScreen.js
│   │   │   ├── 📄 RegisterScreen.js
│   │   │   ├── 📄 SavingsGoalsScreen.js
│   │   │   └── 📄 SettingsScreen.js
│   │   └── 📁 services
│   │       └── 📄 api.js
│   ├── 📄 App.js
│   ├── 🐳 Dockerfile
│   ├── ⚙️ app.json
│   ├── 📄 babel.config.js
│   ├── ⚙️ package-lock.json
│   └── ⚙️ package.json
├── ⚙️ .gitignore
├── ⚙️ docker-compose.yml
└── 📄 env.example
