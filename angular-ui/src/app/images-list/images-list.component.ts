import { Component, OnInit, ViewChild } from '@angular/core';
import { ImageLink } from '../image-link.model';
import { ImagesService } from '../images.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-images-list',
  templateUrl: './images-list.component.html',
  styleUrls: ['./images-list.component.css'],
  template: `
    <button (click)="uploadImage()">Upload Image</button>
  `
})
export class ImagesListComponent implements OnInit {
  listOfImages: ImageLink[] = [];

  constructor(
    private imagesSerivce: ImagesService,
    private router: Router,
  ) { }

  ADMIN_PERMISSIONS = false

  @ViewChild('nameTexbox') nameTexbox;
  @ViewChild('fileButton') fileButton;
  @ViewChild('uploadButton') uploadButton;

  ngOnInit(): void {
    if (this.router.url == '/admin') {
      this.ADMIN_PERMISSIONS = true
    }
    
    this.getServerData()
    this.imagesSerivce.requestServerDataEvent.subscribe((request: string) => {
      this.getServerData()
    })
  }

  getServerData() {
    this.imagesSerivce.getImages().subscribe((data: any)=>{
      this.listOfImages = [];
      for (let i = 0; i < data.length; i++) {
        this.listOfImages.push(new ImageLink(data[i]["name"], data[i]["metadata"], data[i]["url"], data[i]["products"]))
      }
      console.log("Received Collection from Firebase")

      // Display Upload New Market button
      if (this.ADMIN_PERMISSIONS) {
        this.nameTexbox.nativeElement.style.display = "block";
        this.fileButton.nativeElement.style.display = "block";
        this.uploadButton.nativeElement.style.display = "block";
      }
    })
  }

  onFileChange(event) {
    const file = event.target.files[0];
    // Do whatever you need with the file, such as uploading it to a server.
  }

  uploadImage() {
    console.log('Image uploaded');
  }

  CheckPermission() {
    return !this.ADMIN_PERMISSIONS
  }
}
