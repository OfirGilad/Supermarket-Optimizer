import { Component, OnInit, ViewChild } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ProductsListService } from '../products-list.service';
import { Pipe, PipeTransform } from '@angular/core';

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

  filterValue: string;

  listOfProducts = []
  ProductsjsonTxt: string = "{}"
  productIndex = 0
  selectedProducts = JSON

  ngOnInit(): void {
    this.imageCanvasEditingService.imagePathChangedEvent.subscribe((newImageJSON: JSON) => {
      this.selectedProducts['products'] = []
      //this.MetaDataText.nativeElement.value = newImageJSON['metadata'];
      this.ProductsjsonTxt = newImageJSON['products'];
      console.log(this.ProductsjsonTxt)

      var json = JSON.parse(this.ProductsjsonTxt);

      // Sort products alphabetically
      json = Object.keys(json).sort().reduce(
        (obj, key) => { 
          obj[key] = json[key]; 
          return obj;
        }, 
        {}
      );

      this.listOfProducts =[]
      this.productIndex = 0;

      for (let key in json) {
        this.listOfProducts.push({name: key, value: this.productIndex, checked: false})
        this.productIndex++;
      }

      //this.addButton.nativeElement.style.display = "block";
      this.findButton.nativeElement.style.display = "block";
    })
  }

  updateCheckedProduct(product, event) {
    this.listOfProducts[product.value].checked = event.target.checked;
    //console.log(this.listOfProducts)
    if (event.target.checked == true) {
      this.selectedProducts['products'].push(product.name)
    }
    else {
      let index = this.selectedProducts['products'].indexOf(product.name)
      this.selectedProducts['products'].splice(index, 1)
    }

    // Request to update the point on the canvas
    var selectedProductStatus = JSON
    selectedProductStatus["name"] = product.name
    selectedProductStatus["value"] = event.target.checked
    this.productsListService.setSelectedProduct(selectedProductStatus)
  }

  addProduct(){
    console.log('Open Add Product')
  }

  findPath() {
    this.productsListService.setProducts(this.selectedProducts)
  }
}

// Filter class
@Pipe({
  name: 'filter'
})

export class FilterPipe implements PipeTransform {
  transform(items: any[], filter: string): any {
    if (!items || !filter) {
      return items;
    }
    return items.filter(item => item.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1);
  }
}

