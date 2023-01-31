import { Component, OnInit, ViewChild, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ProductsListService } from '../products-list.service';
import { Pipe, PipeTransform } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-products-list',
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.css']
})
export class ProductsListComponent implements OnInit {

  constructor(
    private imageCanvasEditingService: ImageCanvasEditingService,
    private productsListService: ProductsListService,
    private router: Router,
  ) { }
  
  ADMIN_PERMISSIONS = false

  @ViewChild('filterBar') filterBar;
  
  @ViewChildren('statusButtons') statusButtons: QueryList<ElementRef>;
  @ViewChildren('removeButtons') removeButtons: QueryList<ElementRef>;

  @ViewChild('newProductLabel') newProductLabel;
  @ViewChild('nameTexbox') nameTexbox;

  @ViewChild('addButton') addButton;
  @ViewChild('findButton') findButton;
  @ViewChild('saveButton') saveButton;

  filterValue: string;

  listOfProducts = []
  ProductsjsonTxt: string = "{}"
  productIndex = 0
  selectedProducts = JSON

  async ngOnInit(): Promise<void> {
    if (this.router.url == '/admin') {
      this.ADMIN_PERMISSIONS = true
    }

    this.imageCanvasEditingService.imagePathChangedEvent.subscribe(async (newImageJSON: JSON) => {
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

      this.filterBar.nativeElement.style.display = "block";
      this.findButton.nativeElement.style.display = "block";

      if(this.ADMIN_PERMISSIONS) {
        this.newProductLabel.nativeElement.style.display = "block";
        this.nameTexbox.nativeElement.style.display = "block";
        this.addButton.nativeElement.style.display = "block";

        this.saveButton.nativeElement.style.display = "block";
        // console.log(this.removeButtons)
        
        await this.sleep(10);

        this.removeButtons.forEach(removeBTN => {
          // console.log(removeBTN.nativeElement)
          removeBTN.nativeElement.style.display = "block";
        });
        this.statusButtons.forEach(statusBTN => {
          // console.log(removeBTN.nativeElement)
          statusBTN.nativeElement.style.display = "block";
        });
      }
    })

    this.imageCanvasEditingService.newSelectedProductEvent.subscribe((newSelectedProductsJSON: JSON) => {
      for (let i = 0; i < this.listOfProducts.length; i++) {
        console.log(newSelectedProductsJSON);
        
        if (newSelectedProductsJSON['products'].indexOf(this.listOfProducts[i]['name']) != -1) {
          this.listOfProducts[i]['checked'] = true
        }
        else {
          this.listOfProducts[i]['checked'] = false
        }
      }
    })
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
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

  findPath() {
    this.productsListService.setProducts(this.selectedProducts)
  }

  enableProduct(product_value) {
    console.log(product_value)
    console.log('Open Remove Product')
  }

  removeProduct(product_value) {
    console.log(product_value)
    console.log('Open Remove Product')
  }

  addProduct() {
    console.log('Open Add Product')
  }
 
  saveProducts() {
    console.log('Send message to server')
  }

  CheckPermission() {
    return !this.ADMIN_PERMISSIONS
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

