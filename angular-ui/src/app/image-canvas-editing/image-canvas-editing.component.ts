import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ProductsListService } from '../products-list.service';
import { FindPathService } from '../find-path.service';
import { MetadataService } from '../metadata.service';
import { fabric } from 'fabric';
import { Router } from '@angular/router';
import { ImagesService } from '../images.service';

@Component({
  selector: 'app-image-canvas-editing',
  templateUrl: './image-canvas-editing.component.html',
  styleUrls: ['./image-canvas-editing.component.css'],
  template: `
    <canvas #canvas width="600" height="300"></canvas>
  `,
  styles: ['canvas { border-style: solid }']
})
export class ImageCanvasEditingComponent implements OnInit {

  constructor(
    private imageCanvasEditingService: ImageCanvasEditingService,
    private productsListService: ProductsListService,
    private findPathService: FindPathService,
    private metadataService: MetadataService,
    private router: Router,
    private imagesService: ImagesService,
  ) { }

  ADMIN_PERMISSIONS = false
  DEBUG_PERMISSIONS = false

  @ViewChild('canvas', { static: true })
  canvas: ElementRef<HTMLCanvasElement>;  
  fabric_canvas: any;
  
  @ViewChild('area') menuArea;

  currentImagePath: string = "";
  
  listOfProducts = []
  productIndex = 0

  selectedProducts: JSON
  numberOfSelectedProducts = 0

  globalSelectedProduct: JSON
  find_path_status = false

  ngOnInit(): void {
    if (this.router.url == '/admin' || this.router.url == '/debug') {
      this.ADMIN_PERMISSIONS = true
    }
    if (this.router.url == '/debug') {
      this.DEBUG_PERMISSIONS = true
    }

    this.globalSelectedProduct = JSON.parse('{}')
    this.globalSelectedProduct['products'] = []
    this.find_path_status = false
    this.temp_points_list = []
    

    this.fabric_canvas = new fabric.Canvas('canvas');
    this.fabric_canvas.clear();
    this.fabric_canvas.selection = false; // disable group selection

    // Get notify on image recived
    this.imageCanvasEditingService.imagePathChangedEvent.subscribe((newImageJSON: JSON) => {
      const img = new Image();
      img.src = newImageJSON['url'];
      
      this.MetaDataText.nativeElement.value = '{}'
      this.ClearAnnotations(true)

      this.MetaDataText.nativeElement.value = newImageJSON['metadata'];
      this.MetajsonTxt = newImageJSON['metadata'];

      // Set product list - START
      this.selectedProducts = JSON.parse('{}')
      this.selectedProducts['products'] = []
      var json = JSON.parse(newImageJSON['products']);

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
      // Set product list - END

      var fabric_canvas = this.fabric_canvas;
      fabric_canvas.clear();
      
      fabric_canvas.setBackgroundImage(img.src, fabric_canvas.renderAll.bind(fabric_canvas), {
        backgroundImageOpacity: 1,      
      });

      fabric_canvas.setWidth(img.width);
      fabric_canvas.setHeight(img.height);

      this.currentImagePath = newImageJSON['url']

      this.menuArea.nativeElement.style.width = img.width + 'px';
      this.menuArea.nativeElement.style.height = img.height + 'px';

      this.SendMetaData();
    })

    // Get notify on find path command
    this.productsListService.requestPathEvent.subscribe((productsJSON: JSON) => {
      var findPathJSON = JSON.parse(this.MetajsonTxt)
      findPathJSON['Products'] = productsJSON["products"]

      var starting_point_not_found = true
      for (let i = 0; i < findPathJSON["Points"].length; i++) {
        if (findPathJSON["Points"][i]["color"] == "green") {
          starting_point_not_found = false
        }
      }

      if (starting_point_not_found) {
        alert("No Starting Point was selected")
          return
      }

      // Reset Edges Colors
      if (findPathJSON['Connections'] != null) {
        for (let i = 0; i < findPathJSON['Connections'].length; i++) {
          findPathJSON['Connections'][i]["color"] = "black"
        }
      }

      this.find_path_status = true

      // Call for result from backend
      this.FindPathCall(findPathJSON)
    })

    // Get notifyied on selected product to color
    this.productsListService.selectedProductEvent.subscribe((selectedProductJSON: JSON) => {
      var json = JSON.parse(this.MetajsonTxt)
      this.globalSelectedProduct['products'] = selectedProductJSON['products']
      var points = json['Points']

      // Reset Edges Colors
      if (points != null) {
        for (let i = 0; i < points.length; i++) {
          if (points[i]["products"].indexOf(selectedProductJSON["name"]) != -1) {
            if(points[i]["color"] != "green") {
              if (selectedProductJSON["value"] == true) {
                json["Points"][i]["color"] = "blue"
              }
              else {
                json["Points"][i]["color"] = "black"
              }
            }
          }
        }
      }
      this.MetaDataText.nativeElement.value = JSON.stringify(json)
      this.SendMetaData()
    })

    // Product got added to the list
    this.productsListService.productAddedEvent.subscribe((updateProductsListJSON: JSON) => {
      // Copy by value to prevent direct referencing
      this.listOfProducts = []
      this.productIndex = 0

      for (let i = 0; i < updateProductsListJSON['products'].length; i++) {
        var product = updateProductsListJSON['products'][i]
          this.listOfProducts.push({name: product['name'], value: i, checked: product['checked'], disabled: product['disabled']});
        this.productIndex++;
      }
      //console.log(this.listOfProducts);
    })
    
    // Product got removed from the list
    this.productsListService.productRemovedEvent.subscribe((updateProductsListJSON: JSON) => {
      // Copy by value to prevent direct referencing
      this.listOfProducts = []
      this.productIndex = 0

      for (let i = 0; i < updateProductsListJSON['products'].length; i++) {
        var product = updateProductsListJSON['products'][i]
          this.listOfProducts.push({name: product['name'], value: i, checked: product['checked'], disabled: product['disabled']});
        this.productIndex++;
      }
      //console.log(this.listOfProducts);

      var productToRemove = updateProductsListJSON['removedName']
      //console.log(productToRemove);
      

      var json = JSON.parse(this.MetajsonTxt)
      var points = json["Points"]
      // Reset Edges Colors
      if (points != null) {
        for (let i = 0; i < points.length; i++) {
          if (points[i]["products"].indexOf(productToRemove) != -1) {
            json["Points"][i]["products"] = this.RemoveElementFromStringArray(points[i]["products"], productToRemove)
          }
        }
      }
      this.MetaDataText.nativeElement.value = JSON.stringify(json)
      this.MetajsonTxt = this.MetaDataText.nativeElement.value
    })

    // Add events
    this.fabric_canvas.on('object:moving', this.updateOnPointsMoving);
  }


  disableOtherOptions(currently_selected) {
    var all_options = {
      "EditPosition": this.DisableEditPositionsMode,
      "PointProductsUpdate": this.DisablePointProductsUpdateMode,
      "SelectStartingPoint": this.DisableSelectStartingPointMode,
      "DeselectStartingPoint": this.DisableDeselectStartingPointMode,
      "AddPoint": this.DisableAddPointsMode,
      "AddConnection": this.DisableAddConnectionsMode,
      "RemovePoint": this.DisableRemovePointsMode,
      "RemoveConnection": this.DisableRemoveConnectionsMode,
      "Metadata": this.DisableShowMetaData,
    }

    if (currently_selected == "EditPosition") {
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "PointProductsUpdate") {
      this.DisableEditPositionsMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "SelectStartingPoint") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "DeselectStartingPoint") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "AddPoint") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "AddConnection") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "RemovePoint") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "RemoveConnection") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableShowMetaData()
    }

    if (currently_selected == "Metadata") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
    }

    this.CurrentClicked = currently_selected

    if (currently_selected == "ALL") {
      this.DisableEditPositionsMode()
      this.DisablePointProductsUpdateMode()
      this.DisableSelectStartingPointMode()
      this.DisableDeselectStartingPointMode()
      this.DisableAddPointsMode()
      this.DisableAddConnectionsMode()
      this.DisableRemovePointsMode()
      this.DisableRemoveConnectionsMode()
      this.DisableShowMetaData()

      this.CurrentClicked = ""
    }
  }

  @ViewChild('productSelectionInput') productSelectionInput;

  @ViewChild('MetaData') metaData;

  CurrentClicked: string = "";
  
  // Points list
  points_counter: number = 0;
  points_list = []
  temp_points_list = []

  // Connections List
  connections_counter: number = 0;
  connections_list = []

  // Tooltips and Arrows list
  tooltips_list = []
  arrows_list = []

  // For Point
  point_x: number = 0;
  point_y: number = 0;


  // EditPosition - Modes
  edit_positions_mode_stage1: boolean = false
  
  // AddConnection - Modes
  add_connections_mode_stage1: boolean = false

  // RemoveConnection - Modes
  remove_connections_mode_stage1: boolean = false

  // PointProductsUpdate - Modes
  points_products_update_mode_stage1: boolean = false

  OnClick(e: any) {
    //var offset = this.fabric_canvas._offset;
    var offset = this.canvas.nativeElement.getBoundingClientRect();

    if (this.CurrentClicked == "EditPosition"){
      var json = JSON.parse(this.MetajsonTxt);
      let points = json["Points"];
      
      // Check Points
      if (points != null) {
        for (let i = 0; i < this.points_list.length; i++) {
          this.points_list[i].selectable = true;

          // disable scaling
          this.points_list[i].setControlsVisibility({
            mt: false, 
            mb: false, 
            ml: false, 
            mr: false, 
            bl: false,
            br: false, 
            tl: false, 
            tr: false,
          });
        }
      }
    }

    else if (this.CurrentClicked == "PointProductsUpdate"){
      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      if (this.points_products_update_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findSelectedPoint(User_X, User_Y)

          this.productSelectionInput.nativeElement.style.display = "block";
          this.productSelectionInput.nativeElement.style.top = e.pageY + "px";
          this.productSelectionInput.nativeElement.style.left = e.pageX + "px";
        }
      }
      else {
          // Remove temp points and close window
          for (let i = 0; i < this.temp_points_list.length; i++) {
            this.fabric_canvas.remove(this.temp_points_list[i])
          }
          this.temp_points_list = []

          this.productSelectionInput.nativeElement.style.display = "none";
          this.points_products_update_mode_stage1 = false
      }
    }

    else if (this.CurrentClicked == "SelectStartingPoint"){
      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      // console.log(this.MetajsonTxt)
      if (this.MetajsonTxt != '{}') {
        this.findStartingPoint(User_X, User_Y)

        // If Solution is active - Update path and selected products list
        if (this.find_path_status == true) {
          this.handleActiveSolution()
        }
        else {
          this.SendMetaData() 
        }
      } 
    }

    else if (this.CurrentClicked == "AddPoint"){
      this.point_x = e.clientX - offset.left
      this.point_y = e.clientY - offset.top

      var json = JSON.parse(this.MetajsonTxt);
      var points = json["Points"];
      if (points == null) {
        json["Points"] = []
      }

      var curr = {"x": this.point_x, "y": this.point_y, "color": "black", "products": []}
      json["Points"].push(curr)
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;

      var point_id = this.points_counter;
      this.points_counter += 1;

      var point = new fabric.Circle({
        id: point_id,
        radius: 10,
        fill: curr['color'],
        left: curr['x'],
        top: curr['y'],
        selectable: false,
        originX: "center",
        originY: "center",
        hoverCursor: "auto"
      });
      //console.log(point)
      this.fabric_canvas.add(point);
      this.points_list.push(point);


      // Add Tooltip
      var tooltip = new fabric.Text('', {
        id: [-1, point.id],
        fontFamily: 'Arial',
        fontSize: 20,
        left: point.left + 10,
        top: point.top,
        opacity: 0,
        selectable: false
      });
      this.fabric_canvas.add(tooltip);

      point.set('hoverCursor', 'pointer');
      point.on('mouseover', function() {
        if (this.selectable) {
          tooltip.set('opacity', 1);
          tooltip.set('text', point.id + "");
          tooltip.set('left', this.left + 10)
          tooltip.set('top', this.top)
        }
      });
      point.on('mouseout', function() {
        tooltip.set('opacity', 0);
      });

      this.tooltips_list.push(tooltip)

      //console.log(this.tooltips_list)
    }

    else if (this.CurrentClicked == "AddConnection"){
      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      // Selecting First Point
      if (this.add_connections_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findFirstPoint(User_X, User_Y, "ADD")
        }
      }
      else {
          // Selecting Second Point
          this.findSecondPoint(User_X, User_Y, "ADD")
          this.add_connections_mode_stage1 = false
      }
    }
    
    else if (this.CurrentClicked == "RemovePoint") {
      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      // Selecting Point to delete
      if (this.MetajsonTxt != '{}') {
        this.findAndRemovePoint(User_X, User_Y)
      }
    }

    else if (this.CurrentClicked == "RemoveConnection"){
      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      // Selecting First Point
      if (this.remove_connections_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findFirstPoint(User_X, User_Y, "REMOVE")
        }
      }
      else {
          // Selecting Second Point
          this.findSecondPoint(User_X, User_Y, "REMOVE")
          this.remove_connections_mode_stage1 = false
      }
    }

    else if (this.CurrentClicked == "Metadata"){
      if (this.metaData.nativeElement.style.display != "block") {
        this.metaData.nativeElement.style.display = "block";
      }
      else {
        this.metaData.nativeElement.style.display = "none";
      }
      this.metaData.nativeElement.style.top = e.pageY + "px";
      this.metaData.nativeElement.style.left = e.pageX + "px";
    }

    else {
      this.disappearContext()
    } 
  }

  // Right Click Menu - START
  @ViewChild('menu') menu!: ElementRef;

  contextMenu(e: any){
    e.preventDefault();
    if (this.menu.nativeElement.style.display != "block") {
      this.menu.nativeElement.style.display = "block";
    }
    else {
      this.menu.nativeElement.style.display = "none";
    }
    this.menu.nativeElement.style.top = e.pageY + "px";
    this.menu.nativeElement.style.left = e.pageX + "px";
  }
  // Right Click Menu - END


  // Edit Mode Functions - START
  point1_data = []
  point1_index = 0
  min_x1 = 0
  min_y1 = 0
  min_x_dist1 = 0
  min_y_dist1 = 0

  findFirstPoint(x1, y1, mode) {
    this.point1_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr['x']
        var y2 = curr['y']
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.point1_index = i
          this.point1_data = curr
        }
      }

      var selected_x = this.point1_data['x']
      var selected_y = this.point1_data['y']

      if (mode == "ADD") {
        this.color_point(selected_x, selected_y, 'yellow')
        this.add_connections_mode_stage1 = true
      }
      else if (mode == "REMOVE"){
        this.color_point(selected_x, selected_y, 'red')
        this.remove_connections_mode_stage1 = true
      }
      else {
        alert("Invalid Mode")
      }
    }
  }

  point2_index = 0
  point2_data = []
  min_x2 = 0
  min_y2 = 0
  min_x_dist2 = 0
  min_y_dist2 = 0

  findSecondPoint(x1, y1, mode) {
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []

    this.point2_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    let connections = json["Connections"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr['x']
        var y2 = curr['y']
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.point2_index = i
          this.point2_data = curr
        }
      }

      if (this.point1_index != this.point2_index) {
        var new_connection = [this.point1_index, this.point2_index];
        var is_new_connection = true;


        if (mode == "ADD") {
          // Add "Connections" to metadata
          if (connections == null) {
            json["Connections"] = [];
          }
          else {
            var new_connection = [this.point1_index, this.point2_index]

            for (let i = 0; i < connections.length; i++) {
              curr = connections[i];
              var existing_connection1 = [curr['s'], curr['t']]
              var existing_connection2 = [curr['t'], curr['s']]
              
              if ((JSON.stringify(existing_connection1)==JSON.stringify(new_connection)) || 
                  (JSON.stringify(existing_connection2)==JSON.stringify(new_connection))) {
                is_new_connection = false
              }
            }
          }

          // Add only if connection doesn't exist
          if (is_new_connection == true) {
            var to_add = {'s': this.point1_index, 't': this.point2_index, 'color': 'black'}
            json.Connections.push(to_add)
            
            var connection_id = [this.point1_index, this.point2_index];
            this.connections_counter += 1;

            var connection = new fabric.Line(
              [
                points[to_add['s']]['x'], points[to_add['s']]['y'], points[to_add['t']]['x'], points[to_add['t']]['y']
              ],
              {
                id: connection_id,
                stroke: to_add['color'],
                strokeWidth: 2,
                hasControls: false,
                hasBorders: false,
                selectable: false,
                lockMovementX: true,
                lockMovementY: true,
                hoverCursor: "default",
                originX: "center",
                originY: "center"
              }
            );
            //console.log(connection)
            this.fabric_canvas.add(connection);
            this.connections_list.push(connection);

            this.MetajsonTxt = JSON.stringify(json);
            this.MetaDataText.nativeElement.value = this.MetajsonTxt;
          }
        }
        else if (mode == "REMOVE") {
          var connection_to_remove = -1

          // Check if the connection exists
          if (connections != null) {
            var new_connection = [this.point1_index, this.point2_index]

            for (let i = 0; i < connections.length; i++) {
              curr = connections[i];
              var existing_connection1 = [curr['s'], curr['t']]
              var existing_connection2 = [curr['t'], curr['s']]
              
              if ((JSON.stringify(existing_connection1)==JSON.stringify(new_connection)) || 
                  (JSON.stringify(existing_connection2)==JSON.stringify(new_connection))) {
                connection_to_remove = i
              }
            }
          }
          
          // Remove the connection
          if (connection_to_remove != - 1) {
            var updatedList = connections
            updatedList.forEach((_, index)=>{
              if(index==connection_to_remove) updatedList.splice(index,1);
            });
            
            if (updatedList.length == 0) {
              delete json["Connections"]
            }
            else {
              json["Connections"] = updatedList
            }

            var connection = this.connections_list[connection_to_remove]
            //console.log(connection)
            this.fabric_canvas.remove(connection);

            var updatedConnections = this.connections_list
            updatedConnections.forEach((_, index)=>{
              if(index==connection_to_remove) updatedConnections.splice(index,1);
            });

            this.MetajsonTxt = JSON.stringify(json);
            this.MetaDataText.nativeElement.value = this.MetajsonTxt;
          }
        }
        else {
          alert("Invalid Mode")
        }
      }
    }
  }

  point3_index = 0
  point3_data = []
  min_x3 = 0
  min_y3 = 0
  min_x_dist3 = 0
  min_y_dist3 = 0

  findStartingPoint(x1, y1) {
    this.point3_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr['x']
        var y2 = curr['y']
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.point3_index = i
          this.point3_data = curr
        }
      }

      for (let i = 0; i < points.length; i++) {
        if (this.point3_index != i) {
          if (points[i]['color'] != "blue") {
            points[i]['color'] = 'black';
          }
        }
        else {
          points[i]['color'] = 'green';
          this.new_starting_point = i
        }
      }

      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
    }
  }


  point4_index = 0
  point4_data = []
  min_x4 = 0
  min_y4 = 0
  min_x_dist4 = 0
  min_y_dist4 = 0

  findSelectedPoint(x1, y1) {
    this.point4_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr['x']
        var y2 = curr['y']
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.point4_index = i
          this.point4_data = curr
        }
      }

      var selected_x = this.point4_data['x']
      var selected_y = this.point4_data['y']
      this.color_point(selected_x, selected_y, 'yellow')

      this.selected_point = this.point4_index
      this.selectedProducts['products'] = this.point4_data['products']

      for (let i = 0; i < this.listOfProducts.length; i++) {
        if (this.selectedProducts['products'].indexOf(this.listOfProducts[i].name) != -1) {
          this.listOfProducts[i].checked = true
        }
        else {
          this.listOfProducts[i].checked = false
        }
      }
      this.numberOfSelectedProducts = this.selectedProducts['products'].length
      
      this.points_products_update_mode_stage1 = true
    }
  }


  point5_index = 0
  point5_data = []
  min_x5 = 0
  min_y5 = 0
  min_x_dist5 = 0
  min_y_dist5 = 0

  findAndRemovePoint(x1, y1) {
    this.point5_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    let connections = json["Connections"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr['x']
        var y2 = curr['y']
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.point5_index = i
          this.point5_data = curr
        }
      }
      
      // Delete related Connections
      if (connections != null) {
        var updatedConnectionsList = connections
        
        var index = 0
        while (index < updatedConnectionsList.length) {
          if((updatedConnectionsList[index]["s"] == this.point5_index) || (updatedConnectionsList[index]["t"] == this.point5_index)) {
            updatedConnectionsList.splice(index,1);
          }
          else {
            index++;
          }
        }
        
        if (updatedConnectionsList.length == 0) {
          delete json["Connections"]
        }
        else {
          json["Connections"] = updatedConnectionsList
        }
      }
      connections = json["Connections"]

      if (connections != null) {
        for (let i = 0; i < connections.length; i++) {
          if (connections[i]["s"] > this.point5_index) {
            json["Connections"][i]["s"]--;
          }
          if (connections[i]["t"] > this.point5_index) {
            json["Connections"][i]["t"]--;
          }
        }
      }
      
      // Delete Point
      var updatedPointsList = points
      updatedPointsList.forEach((_, index)=>{
        if(index == this.point5_index) updatedPointsList.splice(index,1);
      });
      
      if (updatedPointsList.length == 0) {
        delete json["Points"]
      }
      else {
        json["Points"] = updatedPointsList
      }

      this.MetaDataText.nativeElement.value = JSON.stringify(json);
      this.SendMetaData()
    }
  }
  // Edit Mode Functions - END


  // Buttons Implementation - START
  EditPositionsMode() {
    this.disappearContext();
    if (this.CurrentClicked != "EditPosition") {
      // Disable other options
      this.disableOtherOptions("EditPosition");

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false

      this.OptionSelected(1, true)
      this.OnClick("NONE")
    }
    else {
      this.DisableEditPositionsMode()
    }
  }

  DisableEditPositionsMode() {
    this.OptionSelected(1, false)
    this.fabric_canvas.discardActiveObject().renderAll();
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    
    // Check Points
    if (points != null) {
      for (let i = 0; i < this.points_list.length; i++) {
        this.points_list[i].selectable = false;
      }
    }
    
    for (let i = 0; i < this.points_list.length; i++) {
      json.Points[i]['x'] = this.points_list[i].left;
      json.Points[i]['y'] = this.points_list[i].top;
    }

    this.MetajsonTxt = JSON.stringify(json);
    this.MetaDataText.nativeElement.value = this.MetajsonTxt;

    this.CurrentClicked = "";
  }


  PointProductsUpdateMode() {
    this.disappearContext();
    if (this.CurrentClicked != "PointProductsUpdate") {  
      // Disable other options
      this.disableOtherOptions("PointProductsUpdate");

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false

      this.OptionSelected(2, true)
    }
    else {
      this.DisablePointProductsUpdateMode()
    }
  }

  DisablePointProductsUpdateMode() {
    this.OptionSelected(2, false)

    this.points_products_update_mode_stage1 = false

    // Empty yellow points
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []

    // Close window
    this.productSelectionInput.nativeElement.style.display = "none";

    this.CurrentClicked = "";
  }


  SelectStartingPointMode() {
    this.disappearContext();
    if (this.CurrentClicked != "SelectStartingPoint") {
      // Disable other options
      this.disableOtherOptions("SelectStartingPoint");

      this.OptionSelected(3, true)
    }
    else {
      this.DisableSelectStartingPointMode()
    }
  }

  DisableSelectStartingPointMode() {
    this.OptionSelected(3, false)
    this.CurrentClicked = "";
  }


  DeselectStartingPointMode() {
    // Disable other options
    this.disableOtherOptions("DeselectStartingPoint");

    var json = JSON.parse(this.MetajsonTxt)
    var points = json['Points']

    if (points != null){
      for (let i = 0; i < points.length; i++) {
        if (points[i]["color"] == "green") {
          json['Points'][i]["color"] = "black"
        }
      }
    }

    this.MetaDataText.nativeElement.value = JSON.stringify(json);
    this.SendMetaData()
  }

  DisableDeselectStartingPointMode() {
    this.CurrentClicked = "";
  }


  AddPointsMode() {
    this.disappearContext();
    if (this.CurrentClicked != "AddPoint") {
      // Disable other options
      this.disableOtherOptions("AddPoint");

      // Hide Solution
      this.hide_solution_path()
      
      this.OptionSelected(4, true)
    }
    else {
      this.DisableAddPointsMode()
    }
  }

  DisableAddPointsMode() {
    this.OptionSelected(4, false)
    this.CurrentClicked ="";
  }


  AddConnectionsMode() {
    this.disappearContext();
    if (this.CurrentClicked != "AddConnection") {
      // Disable other options
      this.disableOtherOptions("AddConnection");

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false

      this.OptionSelected(5, true)
    }
    else {
      this.DisableAddConnectionsMode()
    }
  }

  DisableAddConnectionsMode() {
    this.OptionSelected(5, false)

    this.add_connections_mode_stage1 = false

    // Empty red points
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []

    this.CurrentClicked = "";
  }


  RemovePointsMode() {
    this.disappearContext();
    if (this.CurrentClicked != "RemovePoint") {
      // Disable other options
      this.disableOtherOptions("RemovePoint");

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false

      this.OptionSelected(6, true)
    }
    else {
      this.DisableRemovePointsMode()
    }
  }

  DisableRemovePointsMode() {
    this.OptionSelected(6, false)
    this.CurrentClicked = "";
  }


  RemoveConnectionsMode() {
    this.disappearContext();
    if (this.CurrentClicked != "RemoveConnection") {
      // Disable other options
      this.disableOtherOptions("RemoveConnection");

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false

      this.OptionSelected(7, true)
    }
    else {
      this.DisableAddConnectionsMode()
    }
  }

  DisableRemoveConnectionsMode() {
    this.OptionSelected(7, false)

    this.remove_connections_mode_stage1 = false

    // Empty red points
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []

    this.CurrentClicked = "";
  }
  
    
  ShowMetaData(){
    this.disappearContext();
    if(this.CurrentClicked != "Metadata") {
      // Disable other options
      this.disableOtherOptions("Metadata");

      this.OptionSelected(8, true)
    }
    else {
      this.DisableShowMetaData()
    }
  }

  DisableShowMetaData() {
    this.OptionSelected(8, false)
    this.CurrentClicked = "";
    this.metaData.nativeElement.style.display = "none";
  }
  
  
  SaveMetadata(){
    this.disappearContext()
    //Disable other options
    this.disableOtherOptions("ALL");

    // Reset All Colors
    var json = JSON.parse(this.MetajsonTxt);
    if (json['Points'] != null) {
      for (let i = 0; i < json['Points'].length; i++) {
        json['Points'][i]["color"] = "black"
      }
    }
    if (json['Connections'] != null) {
      for (let i = 0; i < json['Connections'].length; i++) {
        json['Connections'][i]["color"] = "black"
      }
    }
    if (json['Arrows'] != null) {
      delete json["Arrows"]
    }

    var jsonParams = JSON.parse('{}')
    jsonParams['url'] = this.currentImagePath
    jsonParams['metadata'] = JSON.stringify(json)

    console.log("Sent Json:", jsonParams)

    this.metadataService.saveMetadataInFirebase(jsonParams).subscribe((data: any)=>{
      console.log("Metadata URL:", data);

      this.imagesService.updateData("Requesting Server updated data")
    })
  }
  

  ClearAnnotations(deleteMetadata:boolean = true){
    this.points_counter = 0;
    this.connections_counter = 0;

    this.tooltips_list.forEach(tooltip => {
      this.fabric_canvas.remove(tooltip);
    });

    this.points_list.forEach(point => {
      this.fabric_canvas.remove(point);
    });

    this.connections_list.forEach(connection => {
      this.fabric_canvas.remove(connection);
    });

    this.temp_points_list.forEach(temp_point => {
      this.fabric_canvas.remove(temp_point);
    });

    this.arrows_list.forEach(arrow => {
      this.fabric_canvas.remove(arrow);
    });

    this.points_list = []
    this.connections_list = []
    this.temp_points_list = []

    this.tooltips_list = []
    this.arrows_list = []

    let LastMetadata = this.MetaDataText.nativeElement.value;

    this.disappearContext()

    this.fabric_canvas.clear();
    this.fabric_canvas.setBackgroundImage(this.currentImagePath, this.fabric_canvas.renderAll.bind(this.fabric_canvas), {
      backgroundImageOpacity: 1,      
    });

    try{
      JSON.parse(LastMetadata);
      this.MetaDataText.nativeElement.value = LastMetadata;
    }
    catch{
      alert("Metadata incorrect JSON format");
    }
    
    if (deleteMetadata) {
      this.MetajsonTxt = "{}";
      //Disable other options
      this.disableOtherOptions("ALL");
    }
  }
  // Buttons Implementation - END


  // Utill Functions - START
  @ViewChild('MetaDataText') MetaDataText;
  MetajsonTxt: string = "{}"

  SendMetaData(){
    this.ClearAnnotations(false)
    this.MetajsonTxt = this.MetaDataText.nativeElement.value;
    this.DrawMetaData();
    this.metaData.nativeElement.style.display = "none";
  }

  DrawMetaData(){
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    let connections = json["Connections"];
    let arrows = json["Arrows"];

    let curr = [];
    let tooltips_list = []

    // Draw Connections before points, to display the points above the connections

    // Draw Connections
    if (connections != null) {
      for (let i = 0; i < connections.length; i++) {
        curr = connections[i];

        let point1 = points[curr['s']];
        let point2 = points[curr['t']];

        //this.drawLine(point1['x'], point1['y'], point2['x'], point2['y'], curr['color']);
        var connection_id = [curr['s'], curr['t']];
        this.connections_counter += 1;
        
        var connection_width = 2

        // Increase line width for solution connection
        if (curr['color'] == "blue") {
          connection_width = 5
        }

        var connection = new fabric.Line(
          [
            point1['x'], point1['y'], point2['x'], point2['y']
          ],
          {
            id: connection_id,
            stroke: curr['color'],
            strokeWidth: connection_width,
            hasControls: false,
            hasBorders: false,
            selectable: false,
            lockMovementX: true,
            lockMovementY: true,
            hoverCursor: "default",
            originX: "center",
            originY: "center"
          }
          );
          this.fabric_canvas.add(connection);
          this.connections_list.push(connection)
      }
    }

    // Draw Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        
        // Starting point was saved in the metadata
        if (curr['color'] == 'green') {
          this.old_starting_point = i
        }

        //this.color_point(curr['x'], curr['y'], curr['color'], 10);
        var point_id = this.points_counter;
        this.points_counter += 1;
        
        var point = new fabric.Circle({
          id: point_id,
          radius: 10,
          fill: curr['color'],
          left: curr['x'],
          top: curr['y'],
          selectable: false,
          originX: "center",
          originY: "center",
          hoverCursor: "auto"
        });
        this.fabric_canvas.add(point);
        this.points_list.push(point);
        
        // Add Tooltip
        var tooltip = new fabric.Text('', {
          id: [-1, i],
          fontFamily: 'Arial',
          fontSize: 20,
          left: point.left + 10,
          top: point.top,
          opacity: 0,
          selectable: false
        });
        this.fabric_canvas.add(tooltip);
        
        tooltips_list.push(tooltip)

        point.set('hoverCursor', 'pointer');
        point.on('mouseover', function() {
          if (this.selectable) {
            tooltips_list[i].set('opacity', 1);
            tooltips_list[i].set('text', i + "");
            tooltips_list[i].set('left', this.left + 10)
            tooltips_list[i].set('top', this.top)
          }
        });
        point.on('mouseout', function() {
          tooltips_list[i].set('opacity', 0);
        });
      }

      this.tooltips_list = tooltips_list
    }

    // Solution arrows
    if (arrows != null) {
      for (let i = 0; i < arrows.length; i++) {
        curr = arrows[i];

        let point1 = points[arrows[i][0]];
        let point2 = points[arrows[i][1]];
        
        let x1 = point1['x']
        let y1 = point1['y']
        let x2 = point2['x']
        let y2 = point2['y']

        let verticalHeight = Math.abs(y2 - y1)
        let horizontalWidth = Math.abs(x2 - x1)
        let tanRatio =  verticalHeight / horizontalWidth
        let basicAngle = Math.atan(tanRatio) * 180 / Math.PI
        
        let arrowAngle = 0

        if (x2 > x1) {
          if (y2 < y1) {
            arrowAngle = -basicAngle
          }
          else if (y2 == y1) {
            arrowAngle = 0
          }
          else if (y2 > y1) {
            arrowAngle = basicAngle
          }
        }

        else if (x2 <= x1) {
          if (y2 > y1) {
            arrowAngle = 180 - basicAngle
          }
          else if (y2 == y1) {
            arrowAngle = 180
          }
          else if (y2 < y1) {
            arrowAngle = 180 + basicAngle
          }
        }

        var arrowhead = new fabric.Polygon(
          [
            {x: 0, y:0},
            {x: -20, y:-10},
            {x: -20, y:10},
          ],
          {
            stroke: "black",
            fill: "blue",
            strokeWidth: 1,
            hasControls: false,
            hasBorders: false,
            selectable: false,
            lockMovementX: true,
            lockMovementY: true,
            hoverCursor: "default",
            originX: "center",
            originY: "center",
            left:  0.95 * point2['x'] + 0.05 * point1['x'],
            top: 0.95 * point2['y'] + 0.05 * point1['y'],
            angle: arrowAngle
          }
          );
          this.fabric_canvas.add(arrowhead);
          this.arrows_list.push(arrowhead)
      }
    }
  }

  async FindPathCall(jsonParams: JSON){
    console.log("Sent Json: ", jsonParams)

    this.findPathService.getFindPathResult(jsonParams).subscribe((data: any)=>{
      console.log("Solution Json: ", data);

      this.MetaDataText.nativeElement.value = JSON.stringify(data)

      this.SendMetaData()
    })

    // Set waiting to getting Path Result
    //await this.sleep(10000);
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  selected_point = 0

  UpdatePointProductsList() {
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []

    var json = JSON.parse(this.MetajsonTxt);
    json["Points"][this.selected_point]["products"] = this.selectedProducts["products"]

    this.MetajsonTxt = JSON.stringify(json);
    this.MetaDataText.nativeElement.value = this.MetajsonTxt;

    for (let i = 0; i < json["Points"].length; i++) {
      if (json["Points"][i]['color'] != "green") {
        json["Points"][i]['color'] = "black"
        
        //console.log(this.globalSelectedProduct)

        for (let j = 0; j < json["Points"][i]['products'].length; j++) {
          if (this.globalSelectedProduct['products'].indexOf(json["Points"][i]['products'][j]) != -1) {
            json["Points"][i]['color'] = "blue"
            break
          }
        }
      }
    }
    this.MetaDataText.nativeElement.value = JSON.stringify(json);
    this.SendMetaData()
    this.productSelectionInput.nativeElement.style.display = "none";
  }

  updateCheckedProduct(product, event) {
    this.listOfProducts[product.value].checked = event.target.checked;
    if (event.target.checked == true) {
      this.selectedProducts['products'].push(product.name)
    }
    else {
      this.selectedProducts['products'] = this.RemoveElementFromStringArray(this.selectedProducts['products'], product.name)
    }
    this.numberOfSelectedProducts = this.selectedProducts['products'].length
  }

  old_starting_point = -1
  new_starting_point = -1

  handleActiveSolution() {
    if (this.old_starting_point == -1) {
      this.old_starting_point = this.new_starting_point
    }

    var json = JSON.parse(this.MetajsonTxt)

    var old_point_products = json['Points'][this.old_starting_point]['products']
    var new_point_products = json['Points'][this.new_starting_point]['products']

    //console.log(old_point_products);
    //console.log(new_point_products);

    for (let i = 0; i < old_point_products.length; i++) {
      this.globalSelectedProduct['products'] = this.RemoveElementFromStringArray(this.globalSelectedProduct['products'], old_point_products[i])
    }
    for (let i = 0; i < new_point_products.length; i++) {
      this.globalSelectedProduct['products'] = this.RemoveElementFromStringArray(this.globalSelectedProduct['products'], new_point_products[i])
    }

    this.old_starting_point = this.new_starting_point
    this.SendMetaData()

    this.imageCanvasEditingService.setNewSelectedProducts(this.globalSelectedProduct)
    this.productsListService.requestPath(this.globalSelectedProduct)
  }

  RemoveElementFromStringArray(stringArray, element: string) {
    stringArray.forEach((value, index)=>{
        if(value==element) stringArray.splice(index,1);
    });
    return stringArray
  }

  CheckPermission() {
    return !this.ADMIN_PERMISSIONS
  }

  CheckDebugPermission() {
    return !this.DEBUG_PERMISSIONS
  }

  disappearContext(){
    this.menu.nativeElement.style.display = "none";
  }

  stopPropagation(e: any){
    e.stopPropagation();
  }

  color_point(x, y, color='black', radius=5) {
    var point = new fabric.Circle({
      radius: radius,
      fill: color,
      left: x,
      top: y,
      selectable: false,
      originX: "center",
      originY: "center",
      hoverCursor: "auto"
    });
    this.fabric_canvas.add(point);
    this.temp_points_list.push(point);
  }

  points_distance(x1, y1, x2, y2) {
    // console.log("USER",x1,y1)
    // console.log("CANVAS",x2,y2)
    
    // Euclidian - Too many Overflows / Underflows
    // var sum1 = (x2 - x1)^2
    // var sum2 = (y2 - y1)^2
    // var result =  Math.sqrt(sum1 + sum2)

    // Manethen
    var sum1 = Math.abs(x2 - x1)
    var sum2 = Math.abs(y2 - y1)
    var result = sum1 + sum2

    // console.log("RESULT",result)
    return result
  }

  hide_solution_path() {
    var json = JSON.parse(this.MetajsonTxt);
    let connections = json["Connections"];
    let arrows = json["Arrows"];

    if (connections != null) {
      for (let i = 0; i < connections.length; i++) {
        json["Connections"][i]["color"] = "black"
      }
    }
    
    if (arrows != null) {
      this.arrows_list.forEach(arrow => {
        this.fabric_canvas.remove(arrow);
      });
      this.arrows_list = []

      delete json["Arrows"]
    }

    this.MetaDataText.nativeElement.value = JSON.stringify(json)
    this.SendMetaData()
  }

  // Update line + tooltip according to current point location
  updateOnPointsMoving(o) {
    let obj = o.target;
    var fabric_canvas = obj.canvas;
    
    fabric_canvas._objects.forEach(o => {
      var object_id_type = typeof o.id;

      if (object_id_type == 'object') {
        // line update
        if (o.id[0] == obj.id) {
          o.set({
            x1: obj.left,
            y1: obj.top
          })
        }
        if (o.id[1] == obj.id) {
          o.set({
            x2: obj.left,
            y2: obj.top
          })
        }

        // tooltip update
        if (o.id[0] == -1) {
          if (o.id[1] == obj.id) {
            o.set({
              left: obj.left + 10,
              top: obj.top
            })
          }
        }
      }
    })
  }
  // Utill Functions - END

  
  // Change buttons colors - START
  @ViewChild('Option1') Option1;
  @ViewChild('Option2') Option2;
  @ViewChild('Option3') Option3;
  @ViewChild('Option4') Option4;
  @ViewChild('Option5') Option5;
  @ViewChild('Option6') Option6;
  @ViewChild('Option7') Option7;
  @ViewChild('Option8') Option8;

  OptionSelected(option_num, status) {
    var color_value = 'white'
    if (status == true) {
      color_value = 'green'
    }

    if (option_num == 1) {
      this.Option1.nativeElement.style.color = color_value
    }
    if (option_num == 2) {
      this.Option2.nativeElement.style.color = color_value
    }
    if (option_num == 3) {
      this.Option3.nativeElement.style.color = color_value
    }
    if (option_num == 4) {
      this.Option4.nativeElement.style.color = color_value
    }
    if (option_num == 5) {
      this.Option5.nativeElement.style.color = color_value
    }
    if (option_num == 6) {
      this.Option6.nativeElement.style.color = color_value
    }
    if (option_num == 7) {
      this.Option7.nativeElement.style.color = color_value
    }
    if (option_num == 8) {
      this.Option8.nativeElement.style.color = color_value
    }
  }
  // Change buttons colors - END
}
