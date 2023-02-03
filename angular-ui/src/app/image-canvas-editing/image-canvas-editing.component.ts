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
    if (this.router.url == '/admin') {
      this.ADMIN_PERMISSIONS = true
    }
    this.globalSelectedProduct = JSON.parse('{}')
    this.globalSelectedProduct['products'] = []
    this.find_path_status = false
    
    // Clean Canvas
    // this.ctx = this.canvas.nativeElement.getContext('2d');
    // this.image.src = "";
    // this.ctx.drawImage(this.image, 0, 0);

    this.fabric_canvas = new fabric.Canvas('canvas');
    this.fabric_canvas.clear();
    this.fabric_canvas.selection = false; // disable group selection

    // Get notify on image recived
    this.imageCanvasEditingService.imagePathChangedEvent.subscribe((newImageJSON: JSON) => {
      const img = new Image();
      img.src = newImageJSON['url'];
      
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
      this.listOfProducts = updateProductsListJSON['products']
    })
    
    // Product got removed from the list
    this.productsListService.productRemovedEvent.subscribe((updateProductsListJSON: JSON) => {
      this.listOfProducts = updateProductsListJSON['products']
      var productToRemove = updateProductsListJSON['removedName']
      console.log(productToRemove);
      

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

  @ViewChild('productSelectionInput') productSelectionInput;

  @ViewChild('MetaData') metaData;

  @ViewChild('textInput') textInput;


  // START FROM HERE

  CurrentClicked: string = "";
  LastClicked: string = "";
  
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


  disableOtherOptions() {
    this.CurrentClicked = "Point";
    this.DrawPoint();
    this.CurrentClicked = "Metadata";
    this.CallMetaData();
    // this.CurrentClicked = "PointProductsUpdate";
    // this.PointProductsUpdateMode();
    this.CurrentClicked = "SelectStartingPoint";
    this.SelectStartingPointMode();

    this.LastClicked = "";
  }


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
      this.disableOtherOptions()
      this.CurrentClicked = "EditPosition";

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

    else if (this.CurrentClicked == "AddConnection"){
      this.disableOtherOptions()
      this.CurrentClicked = "AddConnection";

      // Used to reset colored dots after selection
      //this.SendMetaData()
      this.CurrentClicked = "AddConnection";

      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top


      // Selecting First Point
      if (this.add_connections_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findFirstPoint(User_X, User_Y, "ADD")
          this.CurrentClicked = "AddConnection";
        }
      }
      else {
          // Selecting Second Point
          this.findSecondPoint(User_X, User_Y, "ADD")
          this.add_connections_mode_stage1 = false
      }
    }

    else if (this.CurrentClicked == "SelectStartingPoint"){
      this.disableOtherOptions()
      this.CurrentClicked = "SelectStartingPoint";

      // Used to reset colored dots after selection
      //this.SendMetaData()
      this.CurrentClicked = "SelectStartingPoint";

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
        this.CurrentClicked = "";
      } 
    }

    else if (this.CurrentClicked == "RemoveConnection"){
      this.disableOtherOptions()
      this.CurrentClicked = "RemoveConnection";

      // Used to reset colored dots after selection
      //this.SendMetaData()
      this.CurrentClicked = "RemoveConnection";

      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      // Selecting First Point
      if (this.remove_connections_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findFirstPoint(User_X, User_Y, "REMOVE")
          this.CurrentClicked = "RemoveConnection";
        }
      }
      else {
          // Selecting Second Point
          this.findSecondPoint(User_X, User_Y, "REMOVE")
          this.remove_connections_mode_stage1 = false
      }
    }

    else if (this.CurrentClicked == "Metadata"){
      this.disableOtherOptions()
      this.CurrentClicked = "Metadata";
      
      this.metaData.nativeElement.style.display = "block";
      this.metaData.nativeElement.style.top = e.pageY + "px";
      this.metaData.nativeElement.style.left = e.pageX + "px";
    }

    else if (this.CurrentClicked == "PointProductsUpdate"){
      this.disableOtherOptions()
      this.CurrentClicked = "PointProductsUpdate";

      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      if (this.points_products_update_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findSelectedPoint(User_X, User_Y)
          this.CurrentClicked = "PointProductsUpdate";

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

          this.productSelectionInput.nativeElement.style.display = "none";
          this.points_products_update_mode_stage1 = false
      }
    }

    else if (this.CurrentClicked == "Point"){
      this.disableOtherOptions()
      this.CurrentClicked = "Point";

      this.point_x = e.clientX - offset.left
      this.point_y = e.clientY - offset.top
      //this.color_point(this.point_x, this.point_y, 'black', 10)

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
      console.log(point)
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

      console.log(this.tooltips_list)
    }

    else if (this.CurrentClicked == "RemovePoint") {
      this.disableOtherOptions()
      this.CurrentClicked = "RemovePoint";

      // Used to reset colored dots after selection
      //this.SendMetaData()
      this.CurrentClicked = "RemovePoint";

      var User_X = e.pageX - offset.left
      var User_Y = e.pageY - offset.top

      // Selecting Point to delete
      if (this.MetajsonTxt != '{}') {
        this.findAndRemovePoint(User_X, User_Y)
        this.CurrentClicked = "RemovePoint";
      }
    }

    else {
      this.textInput.nativeElement.style.display = "none";
      this.disappearContext()
    } 
  }

  OnEnter(e: any) {
    // console.log(this.CurrentClicked)
  }

  // Right Click Menu - START
  @ViewChild('menu') menu!: ElementRef;

  contextMenu(e: any){
    e.preventDefault();
    if (this.edit_positions_mode_stage1 == false) {
      this.menu.nativeElement.style.display = "block";
      this.menu.nativeElement.style.top = e.pageY + "px";
      this.menu.nativeElement.style.left = e.pageX + "px";
    }

    if (this.add_connections_mode_stage1 == false) {
      this.menu.nativeElement.style.display = "block";
      this.menu.nativeElement.style.top = e.pageY + "px";
      this.menu.nativeElement.style.left = e.pageX + "px";
    }
  }
  // Right Click Menu - END


  // Edit Mode - START
  // annotation_index = 0
  // annotation_type: string = ''
  // annotation_data = []
  // point_index = 0
  // min_x = 0
  // min_y = 0
  // min_x_dist = 0
  // min_y_dist = 0

  // findClosestPoint(x1, y1) {
  //   this.annotation_type = ''
  //   this.annotation_data = []
  //   var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
  //   var json = JSON.parse(this.MetajsonTxt);
  //   let points = json["Points"];
    
  //   let curr = [];   

  //   // Check Points
  //   if (points != null) {
  //     for (let i = 0; i < points.length; i++) {
  //       curr = points[i];
  //       var x2 = curr['x']
  //       var y2 = curr['y']
  //       var distance = this.points_distance(x1, y1, x2, y2)
        
  //       if (distance < min_distance) {
  //         min_distance = distance
  //         this.annotation_index = i
  //         this.annotation_type = 'Points'
  //         this.annotation_data = curr
  //       }
  //     }

  //     var selected_x = this.annotation_data['x']
  //     var selected_y = this.annotation_data['y']
  //     this.color_point(selected_x, selected_y, 'red')
  //     this.edit_annotations_mode_stage1 = true
  //   }
  // }

  
  // setSelectedPoint(x, y) {
  //   this.min_x_dist = x - this.min_x
  //   this.min_y_dist = y - this.min_y

  //   // update to metadata

  //   if (this.annotation_type  == 'Points') {
  //     var json = JSON.parse(this.MetajsonTxt);
  //     json.Points[this.annotation_index]['x'] = x;
  //     json.Points[this.annotation_index]['y'] = y;
  //     this.MetajsonTxt = JSON.stringify(json);
  //     this.MetaDataText.nativeElement.value = this.MetajsonTxt;
      
  //     this.SendMetaData()   
  //   }
  // }
  // Edit Mode - END




  // Edit Mode - START
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
            console.log(connection)
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
            console.log(connection)
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

        //this.SendMetaData() 
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

      //
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
        updatedConnectionsList.forEach((value, index)=>{
          if(value["s"] == this.point5_index || value["t"] == this.point5_index) updatedConnectionsList.splice(index,1);
        });
        
        if (updatedConnectionsList.length == 0) {
          delete json["Connections"]
        }
        else {
          json["Connections"] = updatedConnectionsList
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


  // Buttons Implementation - START
  EditPositionsMode() {
    this.edit_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "EditPosition") {
      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false

      // Enable Mode
      this.CurrentClicked = "EditPosition";
      this.disableOtherOptions()
      this.CurrentClicked = "EditPosition";
      this.OnClick("NONE")
    }
    else {
      this.edit_in_progress = false
      this.DisableEditPositionsMode()
      this.CurrentClicked = "";
    }
  }

  edit_in_progress = false

  DisableEditPositionsMode() {
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

    //this.SendMetaData()

    // if (this.edit_annotations_mode_stage1 == true && this.edit_in_progress == false) {
    //   this.edit_annotations_mode_stage1 = false
    //   this.edit_annotations_mode_stage2 = false
    //   this.SendMetaData()
    // }
  }

  ///

  AddConnectionsMode() {
    this.add_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "AddConnection") {
      // Disable Other Modes
      this.DisableEditPositionsMode();
      this.DisablePointProductsUpdateMode();
      this.DisableRemoveConnectionsMode();

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false
      
      // Enable Mode
      this.CurrentClicked = "AddConnection";
      this.disableOtherOptions()
      this.CurrentClicked = "AddConnection";
    }
    else {
      this.add_in_progress = false
      this.DisableAddConnectionsMode()
      this.CurrentClicked = "";
      //this.ClearAnnotations(false)
    }
  }

  add_in_progress = false

  DisableAddConnectionsMode() {
    if (this.add_connections_mode_stage1 == true && this.add_in_progress == false) {
      this.add_connections_mode_stage1 = false
      //this.add_connections_mode_stage2 = false
      //this.SendMetaData()
    }

    // Empty red points
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []
  }


  ///

  SelectStartingPointMode() {
    this.disappearContext();
    if (this.CurrentClicked != "SelectStartingPoint") {
      // Disable Other Modes
      this.DisableEditPositionsMode();
      this.DisableAddConnectionsMode();
      this.DisablePointProductsUpdateMode();
      this.DisableRemoveConnectionsMode();

      // Enable Mode
      this.CurrentClicked = "SelectStartingPoint";
      this.disableOtherOptions()
      this.CurrentClicked = "SelectStartingPoint";
    }
    else {
      //this.DisableSelectStartingPointMode()
      this.CurrentClicked = "";
      //this.ClearAnnotations(false)
    }
  }

  DisableSelectStartingPointMode() {
    //this.SendMetaData()
  }

  ////

  RemoveConnectionsMode() {
    this.remove_connection_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "RemoveConnection") {
      // Disable Other Modes
      this.DisableEditPositionsMode();
      this.DisablePointProductsUpdateMode();

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false
      
      // Enable Mode
      this.CurrentClicked = "RemoveConnection";
      this.disableOtherOptions()
      this.CurrentClicked = "RemoveConnection";
    }
    else {
      this.remove_connection_in_progress = false
      this.DisableAddConnectionsMode()
      this.CurrentClicked = "";
      //this.ClearAnnotations(false)
    }
  }

  remove_connection_in_progress = false

  DisableRemoveConnectionsMode() {
    if (this.remove_connections_mode_stage1 == true && this.remove_connection_in_progress == false) {
      this.remove_connections_mode_stage1 = false
    }

    // Empty red points
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []
  }

  RemovePointsMode() {
    //this.remove_connection_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "RemovePoint") {
      // Disable Other Modes
      this.DisableEditPositionsMode();
      this.DisablePointProductsUpdateMode();

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false
      
      // Enable Mode
      this.CurrentClicked = "RemovePoint";
      this.disableOtherOptions()
      this.CurrentClicked = "RemovePoint";
    }
    else {
      //this.remove_connection_in_progress = false
      //this.DisableRemovePointsMode()
      this.CurrentClicked = "";
      //this.ClearAnnotations(false)
    }
  }


  ////
  

  PointProductsUpdateMode() {
    this.product_selection_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "PointProductsUpdate") {  
      // Disable Other Modes
      this.DisableEditPositionsMode();
      this.DisableAddConnectionsMode();
      this.DisableRemoveConnectionsMode();

      // Hide Solution
      this.hide_solution_path()
      this.find_path_status = false

      // Enable Mode
      this.CurrentClicked = "PointProductsUpdate";
      this.disableOtherOptions()
      this.CurrentClicked = "PointProductsUpdate";
    }
    else {
      this.product_selection_in_progress = false
      this.DisablePointProductsUpdateMode()
      this.CurrentClicked = "";
    }
  }

  product_selection_in_progress = false

  DisablePointProductsUpdateMode() {
    if (this.points_products_update_mode_stage1 == true && this.product_selection_in_progress == false) {
      this.points_products_update_mode_stage1 = false
      //this.SendMetaData()
    }

    // Empty yellow points
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []

    // Close window
    this.productSelectionInput.nativeElement.style.display = "none";
  }


  CallMetaData(){
    this.disappearContext();
    if(this.CurrentClicked != "Metadata") {

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditPositionsMode()
      this.product_selection_in_progress = false
      this.DisablePointProductsUpdateMode()
      this.add_in_progress = false
      this.DisableAddConnectionsMode()
      this.remove_connection_in_progress = false
      this.DisableRemoveConnectionsMode()

      this.CurrentClicked = "Metadata";
      this.disableOtherOptions()
      this.CurrentClicked = "Metadata";
    }
    else {
      this.CurrentClicked = "";
      this.metaData.nativeElement.style.display = "none";
    }
  }

  @ViewChild('MetaDataText') MetaDataText;
  MetajsonTxt: string = "{}"

  SendMetaData(){
    this.ClearAnnotations(false)
    this.MetajsonTxt = this.MetaDataText.nativeElement.value;
    this.DrawMetaData();
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

  @ViewChild('FunctionTextToCV') functionTextToCV;

  // @ViewChild('TextToCV') textToCV;
  // CVjsonText: string = '{}'

  //cv_call_image: boolean = false

  async FindPathCall(jsonParams: JSON){
    console.log("Sent Json: ", jsonParams)

    //this.cv_call_image = true

    this.findPathService.getFindPathResult(jsonParams).subscribe((data: any)=>{
      console.log("Solution Json: ", data);

      this.MetaDataText.nativeElement.value = JSON.stringify(data)

      this.SendMetaData()
    })

    // Set waiting to draw annotation after CV function results
    //await this.sleep(10000);
    //this.SendMetaData()
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  SaveMetadata(){
    this.CurrentClicked = ""
    this.OnClick("NONE")

    // Reset Edges Colors
    var json = JSON.parse(this.MetajsonTxt);
    if (json['Connections'] != null) {
      for (let i = 0; i < json['Connections'].length; i++) {
        json['Connections'][i]["color"] = "black"
      }
      this.MetajsonTxt = JSON.stringify(json)
    }

    var jsonParams = JSON.parse('{}')
    jsonParams['url'] = this.currentImagePath
    jsonParams['metadata'] = this.MetajsonTxt

    console.log("Sent Json:", jsonParams)

    this.metadataService.saveMetadataInFirebase(jsonParams).subscribe((data: any)=>{
      console.log("Metadata URL:", data);

      this.imagesService.updateData("Requesting Server updated data")
    })
  }

  DrawPoint() {
    this.disappearContext();
    if (this.CurrentClicked != "Point") {
      // Hide Solution
      this.hide_solution_path()
      
      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditPositionsMode()
      this.product_selection_in_progress = false
      this.DisablePointProductsUpdateMode()
      this.add_in_progress = false
      this.DisableAddConnectionsMode()
      this.remove_connection_in_progress = false
      this.DisableRemoveConnectionsMode()

      this.CurrentClicked = "Point";
      this.disableOtherOptions()
      this.CurrentClicked = "Point";
    }
    else {
      this.CurrentClicked ="";
      this.textInput.nativeElement.style.display = "none";
    }
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

    // this.OptionSelected(0)

    // Disable Edit Mode
   // if (deleteMetadata == true) {
      this.edit_in_progress = false
      this.edit_positions_mode_stage1 = false

      this.product_selection_in_progress = false
      this.points_products_update_mode_stage1 = false

      this.add_in_progress = false
      this.add_connections_mode_stage1 = false
      //this.add_connections_mode_stage2 = false

      this.remove_connection_in_progress = false
      this.remove_connections_mode_stage1 = false
      
      this.productSelectionInput.nativeElement.style.display = "none";
    //}

    let LastMetadata = this.MetaDataText.nativeElement.value;
    this.disableOtherOptions()
    this.disappearContext()
    

    this.fabric_canvas.clear();
    this.fabric_canvas.setBackgroundImage(this.currentImagePath, this.fabric_canvas.renderAll.bind(this.fabric_canvas), {
      backgroundImageOpacity: 1,      
    });
    

    //this.ctx = this.canvas.nativeElement.getContext('2d');

    // Prevent CV returned image from being deleted
    // if(this.cv_call_image == false) {
    //   this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    // }
    
    //this.image.src = this.currentImagePath;
    //this.ctx.drawImage(this.image, 0, 0);

    try{
      JSON.parse(LastMetadata);
      this.MetaDataText.nativeElement.value = LastMetadata;
    }
    catch{
      console.log("Metadata incorrect JSON format");
    }
    
    if(deleteMetadata)
      this.MetajsonTxt = "{}";
  }

  selected_point = 0

  UpdatePointProductsList() {
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.product_selection_in_progress = false

    var json = JSON.parse(this.MetajsonTxt);
    json["Points"][this.selected_point]["products"] = this.selectedProducts["products"]

    this.MetajsonTxt = JSON.stringify(json);
    this.MetaDataText.nativeElement.value = this.MetajsonTxt;

    for (let i = 0; i < json["Points"].length; i++) {
      if (json["Points"][i]['color'] != "green") {
        json["Points"][i]['color'] = "black"
        
        console.log(this.globalSelectedProduct)

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

    //this.OnClick("NONE")
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

    //console.log("HEY LISTEN", this.selectedProducts['products']);

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

  // Buttons Implementation - END


  CheckPermission() {
    return !this.ADMIN_PERMISSIONS
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
}
