import { Component, OnInit } from '@angular/core';
import { ImageLink } from '../image-link.model';
import { ImagesService } from '../images.service';

@Component({
  selector: 'app-images-list',
  templateUrl: './images-list.component.html',
  styleUrls: ['./images-list.component.css']
})
export class ImagesListComponent implements OnInit {
  listOfImages: ImageLink[] = [];

  constructor(
    private imagesSerivce: ImagesService,
  ) { }

  ngOnInit(): void {
    this.imagesSerivce.getImages().subscribe((data: any)=>{
      this.listOfImages = [];
      for (let i = 0; i < data.length; i++) {
        this.listOfImages.push(new ImageLink(data[i]["name"], data[i]["metadata"], data[i]["url"]))
      }
      console.log("Received Collection from Firebase")
    })
  }
}
