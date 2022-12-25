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
  
  listOfProducts = []
  ProductsjsonTxt: string = "{}"

  ngOnInit(): void {
    this.imageCanvasEditingService.imagePathChangedEvent.subscribe((newImageJSON: JSON) => {
      
      //this.MetaDataText.nativeElement.value = newImageJSON['metadata'];
      this.ProductsjsonTxt = newImageJSON['products'];
      console.log(this.ProductsjsonTxt)

      var json = JSON.parse(this.ProductsjsonTxt);
      
      this.listOfProducts =[]
      for (let key in json) {
        this.listOfProducts.push(key)
      }
    })
  }

  addProduct(){
    console.log('Open Add Product')
  }
}
