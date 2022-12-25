import { Component, OnInit } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';

@Component({
  selector: 'app-products-list',
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.css']
})
export class ProductsListComponent implements OnInit {

  constructor(
    private imageCanvasEditingService: ImageCanvasEditingService,
  ) { }
  
  MetajsonTxt: string = "{}"

  ngOnInit(): void {
    this.imageCanvasEditingService.imagePathChangedEvent.subscribe((newImageJSON: JSON) => {
      
      //this.MetaDataText.nativeElement.value = newImageJSON['metadata'];
      this.MetajsonTxt = newImageJSON['metadata'];
      console.log(newImageJSON)
      
    })
  }

}
