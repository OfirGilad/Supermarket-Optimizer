import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { ProductsListService } from '../products-list.service';
import { OpenCVService } from '../opencv.service';
import { MetadataService } from '../metadata.service';
import { fabric } from 'fabric';

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
    private openCVService: OpenCVService,
    private metadataService: MetadataService,
  ) { }

  @ViewChild('canvas', { static: true })
  canvas: ElementRef<HTMLCanvasElement>;  
  fabric_canvas: any;

  private ctx: CanvasRenderingContext2D;

  currentImagePath: string = "";

  @ViewChild('area') menuArea;

  


  ngOnInit(): void {
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

      // img.onload = () => {
      //   this.canvas.nativeElement.width = img.width;
      //   this.canvas.nativeElement.height = img.height;
      //   this.ctx = this.canvas.nativeElement.getContext('2d');
      //   this.ctx.clearRect(0, 0, img.width, img.height);
      //   this.ctx.drawImage(img, 0, 0);

      //   this.currentImagePath = newImageJSON['url']
        
      //   this.menuArea.nativeElement.style.width = img.width + 'px';
      //   this.menuArea.nativeElement.style.height = img.height + 'px';

      //   this.SendMetaData();
      // }

    })

    // Get notify on find path command
    this.productsListService.requestPathEvent.subscribe((productsJSON: JSON) => {
      console.log(productsJSON)
      //console.log(this.MetajsonTxt)

      // Add call for backend
    })

    // Add events
    this.fabric_canvas.on('object:moving', this.updateOnPointsMoving);
  }

  @ViewChild('cvInput') cvInput;

  @ViewChild('MetaData') metaData;

  @ViewChild('textInput') textInput;


  // START FROM HERE


  CurrentClicked: string = "";
  LastClicked: string = "";
  
  points_counter: number = 0;
  points_list = []

  connections_counter: number = 0;
  connections_list = []

  temp_points_list = []

  // For Point
  point_x: number = 0;
  point_y: number = 0;


  disableOtherOptions() {
    this.CurrentClicked = "Point";
    this.DrawPoint();
    this.CurrentClicked = "Metadata";
    this.CallMetaData();
    this.CurrentClicked = "OpenCV";
    this.CVFunction();
    this.CurrentClicked = "SelectStartingPoint";
    this.SelectStartingPointMode();

    this.LastClicked = "";
  }


  // EditPosition - Modes
  edit_positions_mode_stage1: boolean = false
  
  // AddConnection - Modes
  add_connections_mode_stage1: boolean = false


  OnClick(e: any) {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    var rect = this.canvas.nativeElement.getBoundingClientRect();

    if (this.CurrentClicked == "EditPosition"){
      this.disableOtherOptions()
      this.CurrentClicked = "EditPosition";

      //
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

      var User_X = e.pageX - rect.left
      var User_Y = e.pageY - rect.top


      // Selecting First Point
      if (this.add_connections_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findFirstPoint(User_X, User_Y)
          this.CurrentClicked = "AddConnection";
        }
      }
      else {
          // Selecting Second Point
          this.findSecondPoint(User_X, User_Y)
          this.add_connections_mode_stage1 = false
      }
    }


    else if (this.CurrentClicked == "SelectStartingPoint"){
      this.disableOtherOptions()
      this.CurrentClicked = "SelectStartingPoint";

      // Used to reset colored dots after selection
      //this.SendMetaData()
      this.CurrentClicked = "SelectStartingPoint";

      var User_X = e.pageX - rect.left
      var User_Y = e.pageY - rect.top

      // console.log(this.MetajsonTxt)
      if (this.MetajsonTxt != '{}') {
        this.findStartingPoint(User_X, User_Y)
        this.CurrentClicked = "";
      } 
    }

    else if (this.CurrentClicked == "Metadata"){
      this.disableOtherOptions()
      this.CurrentClicked = "Metadata";
      
      this.metaData.nativeElement.style.display = "block";
      this.metaData.nativeElement.style.top = e.pageY + "px";
      this.metaData.nativeElement.style.left = e.pageX + "px";
    }


    else if (this.CurrentClicked == "OpenCV"){
      this.disableOtherOptions()
      this.CurrentClicked = "OpenCV";

      this.textToCV.nativeElement.value = "{}";
      this.cvInput.nativeElement.style.display = "block";
      this.cvInput.nativeElement.style.top = e.pageY + "px";
      this.cvInput.nativeElement.style.left = e.pageX + "px";
    }


    else if (this.CurrentClicked == "Point"){
      this.disableOtherOptions()
      this.CurrentClicked = "Point";

      this.point_x = e.clientX - rect.left
      this.point_y = e.clientY - rect.top
      //this.color_point(this.point_x, this.point_y, 'black', 10)

      var json = JSON.parse(this.MetajsonTxt);
      var line = json.Points;
      if (line == undefined) {
        json.Points = []
      }

      var curr = {"x": this.point_x, "y": this.point_y, "color": "black", "products": []}
      json.Points.push(curr)
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

    // else if (this.annotation_type == "Texts") { 
    //   this.ctx = this.canvas.nativeElement.getContext('2d');
    //   var rect = this.canvas.nativeElement.getBoundingClientRect();

    //   // Edit current Text Box
    //   this.textInput.nativeElement.style.display = "block";
    //   this.textInput.nativeElement.style.top = this.min_y + rect.top - 15 + "px";
    //   this.textInput.nativeElement.style.left = this.min_x + rect.left + "px";
    // }
    // else if (this.annotation_type != "Texts") {
    //   this.ctx = this.canvas.nativeElement.getContext('2d');
    //   var rect = this.canvas.nativeElement.getBoundingClientRect();

    //   for (let i = 0; i < this.annotation_data.length; i++) {
    //     if (i != this.point_index) {
    //       this.color_point(this.annotation_data[i][0], this.annotation_data[i][1], 'yellow')
    //     }
    //   }
    //   this.move_all_points = true
    // }
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

  findFirstPoint(x1, y1) {
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
      this.color_point(selected_x, selected_y, 'red')
      this.add_connections_mode_stage1 = true
    }
  }

  point2_index = 0
  point2_data = []
  min_x2 = 0
  min_y2 = 0
  min_x_dist2 = 0
  min_y_dist2 = 0

  findSecondPoint(x1, y1) {
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

        // Add connection to metadata
        var line = json.Connections;
        if (line == undefined) {
          json.Connections = [];

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
        }

        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;

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
          points[i]['color'] = 'black';
        }
        else {
          points[i]['color'] = 'green';
        }
      }

      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
      this.SendMetaData() 
    }
  }


  // Buttons Implementation - START
  EditPositionsMode() {
    this.edit_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "EditPosition") {

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

      // Enable Mode
      this.CurrentClicked = "AddConnection";
      this.disableOtherOptions()

      // Disable Other Modes
      this.DisableEditPositionsMode();

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

    // Empty red point
    for (let i = 0; i < this.temp_points_list.length; i++) {
      this.fabric_canvas.remove(this.temp_points_list[i])
    }
    this.temp_points_list = []
  }


  ///

  SelectStartingPointMode() {
    this.disappearContext();
    if (this.CurrentClicked != "SelectStartingPoint") {

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
  

  CVFunction() {
    this.disappearContext();
    if (this.CurrentClicked != "OpenCV") {
      // this.OptionSelected(3)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditPositionsMode()
      this.add_in_progress = false
      this.DisableAddConnectionsMode()

      this.CurrentClicked = "OpenCV";
      this.disableOtherOptions()
      this.CurrentClicked = "OpenCV";
    }
    else {
      this.CurrentClicked = "";
      this.cvInput.nativeElement.style.display = "none";
    }
  }

  CallMetaData(){
    this.disappearContext();
    if(this.CurrentClicked != "Metadata") {

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditPositionsMode()
      this.add_in_progress = false
      this.DisableAddConnectionsMode()

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

    let curr = [];

    // Draw Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        this.ctx = this.canvas.nativeElement.getContext('2d');

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
      }
    }

    // Draw Connections
    if (connections != null) {
      for (let i = 0; i < connections.length; i++) {
        curr = connections[i];
        this.ctx = this.canvas.nativeElement.getContext('2d');

        let point1 = points[curr['s']];
        let point2 = points[curr['t']];

        //this.drawLine(point1['x'], point1['y'], point2['x'], point2['y'], curr['color']);
        var connection_id = [curr['s'], curr['t']];
        this.connections_counter += 1;

        var connection = new fabric.Line(
          [
            point1['x'], point1['y'], point2['x'], point2['y']
          ],
          {
            id: connection_id,
            stroke: curr['color'],
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
          this.fabric_canvas.add(connection);
          this.connections_list.push(connection)
      }
    }
  }

  @ViewChild('FunctionTextToCV') functionTextToCV;

  @ViewChild('TextToCV') textToCV;
  CVjsonText: string = '{}'

  cv_call_image: boolean = false

  async OpenCVCall(){
    this.CVjsonText = this.textToCV.nativeElement.value

    var jsonParams = JSON.parse(this.CVjsonText)
    jsonParams['url'] = this.currentImagePath

    var selectedFunction = this.functionTextToCV.nativeElement;
    jsonParams['method'] = selectedFunction.options[selectedFunction.selectedIndex].value;
    
    console.log("Sent Json:", jsonParams)

    this.cv_call_image = true

    this.openCVService.getOpenCVResult(jsonParams).subscribe((data: any)=>{
      // console.log(data);
      var ctx = this.canvas.nativeElement.getContext('2d');
      var image = new Image();

      image.onload = () => {
          ctx.drawImage(image, 0, 0);
      }
      image.src = data;
      this.currentImagePath = data
      this.cvInput.nativeElement.style.display = "none";
    })

    // Set waiting to draw annotation after CV function results
    await this.sleep(10000);
    this.SendMetaData()
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  SaveMetadata(){
    this.CurrentClicked = ""
    this.OnClick("NONE")

    var jsonParams = JSON.parse('{}')
    jsonParams['url'] = this.currentImagePath
    jsonParams['metadata'] = this.MetajsonTxt
    
    console.log("Sent Json:", jsonParams)

    this.metadataService.saveMetadataToFirebase(jsonParams).subscribe((data: any)=>{
      console.log("Metadata URL:", data);
      // window.location.reload();
    })
  }

  DrawPoint() {
    this.disappearContext();
    if (this.CurrentClicked != "Point") {

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditPositionsMode()
      this.add_in_progress = false
      this.DisableAddConnectionsMode()

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

    this.points_list.forEach(point => {
      this.fabric_canvas.remove(point);
    });

    this.connections_list.forEach(connection => {
      this.fabric_canvas.remove(connection);
    });

    this.temp_points_list.forEach(temp_point => {
      this.fabric_canvas.remove(temp_point);
    });

    this.points_list = []
    this.connections_list = []
    this.temp_points_list = []

    // this.OptionSelected(0)

    // Disable Edit Mode
    if (deleteMetadata == true) {
      this.edit_in_progress = false
      this.edit_positions_mode_stage1 = false

      this.add_in_progress = false
      this.add_connections_mode_stage1 = false
      //this.add_connections_mode_stage2 = false
    }

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
  // Buttons Implementation - END



  disappearContext(){
    this.menu.nativeElement.style.display = "none";
  }

  stopPropagation(e: any){
    e.stopPropagation();
  }

  // drawLine(x1, y1, x2, y2, color='black') {
  //   this.ctx = this.canvas.nativeElement.getContext('2d');
  //   //console.log(x1,y1,x2,y2)
  //   this.ctx.beginPath();
  //   this.ctx.moveTo(x1, y1);
  //   this.ctx.lineTo(x2, y2);
  //   this.ctx.strokeStyle = color;
  //   this.ctx.stroke();
  // }

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


  // Update line according to current point location
  updateOnPointsMoving(o) {
    let obj = o.target;
    var fabric_canvas = obj.canvas;
    
    fabric_canvas._objects.forEach(o => {
      var object_id_type = typeof o.id;

      if (object_id_type == 'object') {
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
      }
    })
  }

}
