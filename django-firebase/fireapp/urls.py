from django.urls import re_path
from fireapp import views

urlpatterns = [
    re_path(r'^Images/$', views.Images),
    re_path(r'^Images/([0-9]+)$', views.Images),

    #re_path(r'^openCVHandler/$', views.OpenCVHandler),
    #re_path(r'^openCVHandler/([0-9]+)$', views.OpenCVHandler),

    re_path(r'^saveMetadata/$', views.SaveMetadata),
    re_path(r'^saveMetadata/([0-9]+)$', views.SaveMetadata),

    re_path(r'^saveProducts/$', views.SaveProducts),
    re_path(r'^saveProducts/([0-9]+)$', views.SaveProducts),

    re_path(r'^findPath/$', views.FindPath),
    re_path(r'^findPath/([0-9]+)$', views.FindPath),
]
