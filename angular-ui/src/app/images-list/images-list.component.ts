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
    private imagesService: ImagesService,
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
    this.imagesService.requestServerDataEvent.subscribe((request: string) => {
      this.getServerData()
    })
  }

  getServerData() {
    this.imagesService.imagesRequest("GET", "NONE", "NONE").subscribe((data: any)=>{
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

  selectedFile: File

  onFileChange(event) {
    const file = event.target.files[0];
    this.selectedFile = file
    console.log(this.selectedFile);
    
    // Do whatever you need with the file, such as uploading it to a server.
  }

  uploadImage() {
    var alert_messages = "The upload failed due to the following reason(s): \n"
    var validMarket= true

    var market_name = this.nameTexbox.nativeElement.value;
    if (this.selectedFile == null) {
      alert_messages += "(*) No file was selected \n"
      validMarket = false
    }
    if (market_name.trim() == "") {
      alert_messages += "(*) Market name cannot be empty \n"
      validMarket = false
    }

    if (validMarket) {
      // Send message to server
      var jsonParams = JSON.parse('{}')
      jsonParams['name'] = market_name
      jsonParams['image_name'] = this.selectedFile.name
      // jsonParams['image'] = this.selectedFile

      console.log("Sent Json:", jsonParams)

      this.imagesService.imagesRequest("POST", jsonParams, this.selectedFile).subscribe((data: any)=>{
        console.log(data);

        this.imagesService.updateData("Requesting Server updated data")
      })

      //console.log('Image uploaded');
    }
    else {
      alert(alert_messages)
    }
  }

  CheckPermission() {
    return !this.ADMIN_PERMISSIONS
  }
}
