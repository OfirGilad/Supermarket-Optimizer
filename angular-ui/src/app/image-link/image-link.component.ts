import { Component, Input, OnInit } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ImageLink } from '../image-link.model';
import { Router } from '@angular/router';
import { ImagesService } from '../images.service';

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
    private imagesService: ImagesService,
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
    // Send message to server
    var jsonParams = JSON.parse('{}');
    jsonParams["url"] = this.image.imagePath

    console.log("Sent Json:", jsonParams)

      this.imagesService.imagesRequest("DELETE", jsonParams, "NONE").subscribe((data: any)=>{
        console.log(data);

        this.imagesService.updateData("Requesting Server updated data")
      })
    
    console.log('Image deleted');
  }

  CheckPermission() {
    return !this.ADMIN_PERMISSIONS
  }
}
