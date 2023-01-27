import { Component, OnInit, ViewChild } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ProductsListService } from '../products-list.service';

@Component({
  selector: 'app-products-list',
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.css']
})
export class ProductsListComponent implements OnInit {

  constructor(
    private imageCanvasEditingService: ImageCanvasEditingService,
    private productsListService: ProductsListService,
  ) { }
  
  @ViewChild('addButton') addButton;
  @ViewChild('findButton') findButton;

  listOfProducts = []
  ProductsjsonTxt: string = "{}"
  productIndex = 0

  ngOnInit(): void {
    this.imageCanvasEditingService.imagePathChangedEvent.subscribe((newImageJSON: JSON) => {
      
      //this.MetaDataText.nativeElement.value = newImageJSON['metadata'];
      this.ProductsjsonTxt = newImageJSON['products'];
      console.log(this.ProductsjsonTxt)

      var json = JSON.parse(this.ProductsjsonTxt);
      
      this.listOfProducts =[]
      this.productIndex = 0;

      for (let key in json) {
        this.listOfProducts.push({name: key, value: this.productIndex, checked: false})
        this.productIndex++;
      }
      
      this.addButton.nativeElement.style.display = "block";
      this.findButton.nativeElement.style.display = "block";
    })
  }

  updateCheckedProduct(product, event) {
    this.listOfProducts[product.value].checked = event.target.checked;
    //console.log(this.listOfProducts)
  }

  addProduct(){
    console.log('Open Add Product')
  }

  findPath() {
    var selectedProducts = JSON
    selectedProducts['products'] = []

    for (let i = 0; i < this.listOfProducts.length; i++) {
      if (this.listOfProducts[i].checked == true)
      selectedProducts['products'].push(this.listOfProducts[i].name)
    }

    this.productsListService.setProducts(selectedProducts)
  }
}
