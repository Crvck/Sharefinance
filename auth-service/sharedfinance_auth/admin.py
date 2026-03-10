from django.contrib import admin
from .models import SharedWorkspace, User, WorkspaceMembership

admin.site.register(User)
admin.site.register(SharedWorkspace)
admin.site.register(WorkspaceMembership)
