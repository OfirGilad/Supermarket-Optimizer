import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ImagesListComponent } from './images-list/images-list.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/admin',
    pathMatch: 'full',
  },
  {
    path: 'home',
    component: ImagesListComponent
  },
  {
    path: 'admin',
    component: ImagesListComponent
  }
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
