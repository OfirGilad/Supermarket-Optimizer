import { Component, Input, OnInit } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ImageLink } from '../image-link.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-image-link',
  templateUrl: './image-link.component.html',
  styleUrls: ['./image-link.component.css']
})
export class ImageLinkComponent implements OnInit {
  @Input() image?: ImageLink;
  @Input() index: number = 0;
  dataJSON: JSON;

  constructor(
    private imageCanvasEditingService: ImageCanvasEditingService,
    private router: Router,
  ) { }
  
  ADMIN_PERMISSIONS = false

  ngOnInit(): void {
    if (this.router.url == '/admin') {
      this.ADMIN_PERMISSIONS = true
    }
  }

  openCanvas(imagePath: string, metadataPath: string, productsPath: string) {
    this.dataJSON = JSON.parse('{}');
    this.dataJSON['url'] = imagePath;
    this.dataJSON['metadata'] = metadataPath;
    this.dataJSON['products'] = productsPath;
    this.imageCanvasEditingService.setImagePath(this.dataJSON);
  }

  deleteImage() {
    console.log('Image deleted');
  }

  CheckPermission() {
    return !this.ADMIN_PERMISSIONS
  }
}
