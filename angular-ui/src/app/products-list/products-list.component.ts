import { Component, OnInit, ViewChild, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ProductsListService } from '../products-list.service';
import { Pipe, PipeTransform } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../products.service';
import { ImagesService } from '../images.service';

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
    private productsService: ProductsService,
    private imagesService: ImagesService,
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
  selectedProducts: JSON

  currentImagePath = ""

  async ngOnInit(): Promise<void> {
    if (this.router.url == '/admin') {
      this.ADMIN_PERMISSIONS = true
    }

    this.imageCanvasEditingService.imagePathChangedEvent.subscribe(async (newImageJSON: JSON) => {
      this.selectedProducts = JSON.parse('{}')
      this.selectedProducts['products'] = []
      //this.MetaDataText.nativeElement.value = newImageJSON['metadata'];
      this.ProductsjsonTxt = newImageJSON['products'];
      this.currentImagePath = newImageJSON['url']
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
        var status = !json[key]
        this.listOfProducts.push({name: key, value: this.productIndex, checked: false, disabled: status})
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
          // console.log(statusBTN.nativeElement)
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
    // console.log(this.listOfProducts)
    if (event.target.checked == true) {
      this.selectedProducts['products'].push(product.name)
    }
    else {
      let index = this.selectedProducts['products'].indexOf(product.name)
      this.selectedProducts['products'].splice(index, 1)
    }

    // Request to update the point on the canvas
    var selectedProductStatus: JSON
    selectedProductStatus = JSON.parse('{}')
    selectedProductStatus["name"] = product.name
    selectedProductStatus["value"] = event.target.checked
    selectedProductStatus["products"] = this.selectedProducts['products']
    this.productsListService.setSelectedProduct(selectedProductStatus)
  }

  findPath() {
    this.productsListService.requestPath(this.selectedProducts)
  }

  enableProduct(product_value) {
    this.listOfProducts[product_value]["disabled"] = !this.listOfProducts[product_value]["disabled"]
    console.log('Enabled/Disabled status changed')
  }

  removeProduct(product_value) {
    var updatedList = this.listOfProducts
    let productName = this.listOfProducts[product_value]['name']

    updatedList.forEach((value, index)=>{
      if(value['value']==product_value) updatedList.splice(index,1);
    });

    this.productIndex = 0
    for (let i = 0; i < updatedList.length; i++) {
      this.listOfProducts[i]["value"] =  this.productIndex
      this.productIndex++
    }

    // Send request to canvas to remove the blue color from the deleted product
    var selectedProductStatus: JSON
    selectedProductStatus = JSON.parse('{}')
    selectedProductStatus["name"] = productName
    selectedProductStatus["value"] = false
    selectedProductStatus["products"] = this.selectedProducts['products']
    this.productsListService.setSelectedProduct(selectedProductStatus)

    // Send updated list
    var json = JSON.parse('{}')
    json['products'] = this.listOfProducts
    json['removedName'] = productName
    this.productsListService.setUpdatedProductsList(json, "remove")

    console.log('Product removed successfully')
  }

  async addProduct() {
    var newProductName = this.nameTexbox.nativeElement.value
    if (newProductName.trim() == "") {
      alert("Product name cannot be empty")
    }
    else {
      var validName = true
      for (let i = 0; i < this.listOfProducts.length; i++) {
        if (this.listOfProducts[i]["name"] == newProductName) {
          validName = false
          break
        }
      }
      if (validName) {
        this.listOfProducts.push({name: newProductName, value: this.productIndex, checked: false, disabled: false})
        this.productIndex++

        await this.sleep(10);

        // Display Remove and Enable/Disable buttons
        this.removeButtons.forEach(removeBTN => {
          // console.log(removeBTN.nativeElement)
          removeBTN.nativeElement.style.display = "block";
        });
        this.statusButtons.forEach(statusBTN => {
          // console.log(statusBTN.nativeElement)
          statusBTN.nativeElement.style.display = "block";
        });

        // Send updated list
        var json = JSON.parse('{}')
        json['products'] = this.listOfProducts
        this.productsListService.setUpdatedProductsList(json, "add")

        console.log('Product added successfully')
      }
      else {
        alert("Product name already exists")
      }
    }
  }
 
  saveProducts() {
    var products = {}

    for (let i = 0; i < this.listOfProducts.length; i++) {
      if (this.listOfProducts[i]["disabled"] == false) {
        products[this.listOfProducts[i]["name"]] = 1
      }
      else {
        products[this.listOfProducts[i]["name"]] = 0
      }
    }

    var jsonParams = JSON.parse('{}')
    jsonParams['url'] = this.currentImagePath
    jsonParams['products'] = JSON.stringify(products)

    console.log("Sent Json:", jsonParams)

    this.productsService.saveProductsInFirebase(jsonParams).subscribe((data: any)=>{
      console.log("Products URL:", data);

      this.imagesService.updateData("Requesting Server updated data")
    })
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

