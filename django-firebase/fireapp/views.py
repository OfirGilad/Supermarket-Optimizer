import os
import urllib

from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.http.response import JsonResponse

import pyrebase
import json
from datetime import datetime

import skimage.io
from PIL import Image


# Create your views here.
config = {
    "apiKey": "AIzaSyDA8ElLhy4e3iLN0qFJyB8GlvrnICqQE8c",
    "authDomain": "stochasticoptimizationproject.firebaseapp.com",
    "databaseURL": "https://stochasticoptimizationproject-default-rtdb.firebaseio.com",
    "projectId": "stochasticoptimizationproject",
    "storageBucket": "stochasticoptimizationproject.appspot.com",
    "messagingSenderId": "851769269343",
    "appId": "1:851769269343:web:bbb1e50779845911b6cfea",
    "measurementId": "G-CWYM02S504",
}


firebase = pyrebase.initialize_app(config)
auth = firebase.auth()
database = firebase.database()

firebase_storage = pyrebase.initialize_app(config)
storage = firebase_storage.storage()


def index(request):
    name = database.child('Data').child('Name').get().val()
    stack = database.child('Data').child('Stack').get().val()
    framework = database.child('Data').child('Framework').get().val()

    context = {
        'name': name,
        'stack': stack,
        'framework': framework
    }
    return render(request, 'index.html', context)


def uploadToFirebase(filePath):
    fileName = filePath.split("/")[1]
    storage.child(fileName).put(filePath)

    email = "ofirgila@post.bgu.ac.il"
    password = "Aa123456"
    user = auth.sign_in_with_email_and_password(email, password)
    url = storage.child(fileName).get_url(user['idToken'])
    print(url)

    return url


@csrf_exempt
def Images(request, id=0):
    # Getting images from firebase
    if request.method == 'GET':
        images = database.child('Images').get().val()
        for image in images:
            metadataURL = image['metadata']
            try:
                metadata = urllib.request.urlopen(metadataURL).read().decode('ascii')
            except:
                metadata = '{}'
            image['metadata'] = metadata

            productsURL = image['products']
            try:
                products = urllib.request.urlopen(productsURL).read().decode('ascii')
            except:
                products = '{}'
            image['products'] = products

        return JsonResponse(images, safe=False)


@csrf_exempt
def SaveMetadata(request, id=0):
    # Saving image metadata to firebase
    if request.method == 'POST':
        params = request.body.decode()
        params = json.loads(params)
        url = params["url"]
        metadata = params["metadata"]
        utc = str(datetime.utcnow())
        utc = utc.replace(":", ".")
        # Creating Metadata txt file
        file = open("ImageMetadata/metadata-" + utc + ".txt", "a")
        file.write(metadata)
        file.close()

        MetadataURL = uploadToFirebase("ImageMetadata/metadata-" + utc + ".txt")

        images = database.child('Images').get().val()

        i = 0
        for image in images:
            imageURL = image['url']
            if imageURL == url:
                database.child('Images').child(str(i)).child("metadata").set(MetadataURL)
            i += 1

        return JsonResponse(MetadataURL, safe=False)


@csrf_exempt
def FindPath(request, id=0):
    if request.method == 'POST':
        params = request.body.decode()
        params = json.loads(params)

        solution = params
        solution["Connections"] = get_shortest_path(solution)
        del solution["Products"]

        return JsonResponse(solution, safe=False)


# Sol from web
import heapq


# Helper function to find the vertex with the given product in its metadata
def find_vertex_with_product(product, vertices):
    for vertex in vertices:
        if product in vertex['products']:
            return vertex
    return None


# Helper function to get the weight of an edge
def get_edge_weight(edge, vertices):
    v1 = vertices[edge['s']]
    v2 = vertices[edge['t']]
    return ((v1['x'] - v2['x']) ** 2 + (v1['y'] - v2['y']) ** 2) ** 0.5


def get_shortest_path(data):
    # Extract input data
    vertices = data['Points']
    edges = data['Connections']
    products_list = data['Products']

    start_vertex = None
    # Find the starting and ending vertex for the path
    for i in range(len(vertices)):
        vertices[i]["index"] = i
        if vertices[i]["color"] == "green":
            start_vertex = vertices[i]

    #start_vertex = find_vertex_with_product(products_list[0], vertices)
    end_vertex = find_vertex_with_product(products_list[-1], vertices)

    # Initialize the heap and distances dictionary
    heap = [(0, start_vertex['index'])]
    distances = {vertex['index']: float('inf') for vertex in vertices}
    distances[start_vertex['index']] = 0

    # Initialize the previous dictionary to store the previous vertex for each vertex
    previous = {vertex['index']: None for vertex in vertices}

    while heap:
        # Extract the vertex with the smallest distance from the heap
        current_distance, current_vertex = heapq.heappop(heap)

        # If we've reached the end vertex, we're done
        if current_vertex == end_vertex['index']:
            break

        # Update the distances of the neighboring vertices
        for edge in edges:
            if edge['s'] == current_vertex:
                neighbor_vertex = edge['t']
                weight = get_edge_weight(edge, vertices)
                if current_distance + weight < distances[neighbor_vertex]:
                    distances[neighbor_vertex] = current_distance + weight
                    previous[neighbor_vertex] = current_vertex
                    heapq.heappush(heap, (distances[neighbor_vertex], neighbor_vertex))

    # Reconstruct the shortest path from the previous dictionary
    path = []
    current_vertex = end_vertex['index']
    while current_vertex is not None:
        path.append(current_vertex)
        current_vertex = previous[current_vertex]

    # Reverse the path list to get the path from start to end
    path = path[::-1]

    # Color the edges blue
    for i in range(len(path)-1):
        for j in range(len(edges)):
            if (edges[j]['s'] == path[i] and edges[j]['t'] == path[i+1]) or (edges[j]['s'] == path[i+1] and edges[j]['t'] == path[i]):
                edges[j]["color"] = "blue"

    print(path)
    print(edges)
    return edges

# @csrf_exempt
# def OpenCVHandler(request, id=0):
#     if request.method == 'POST':
#         params = request.body.decode()
#         params = json.loads(params)
#         print(params["method"])
#         return openCVFunctions[params["method"]](params)
#
#
# class CVFunctions:
#     # Converting the image to black and white
#     @staticmethod
#     def OpenCVGrayImage(params):
#         firebaseImage = params['url']
#
#         # Reading the image with the help of OpenCV method.
#         originalImage = skimage.io.imread(firebaseImage)
#
#         try:
#             # Converting the color image to grayscale image.
#             grayImage = cv2.cvtColor(originalImage, cv2.COLOR_BGR2GRAY)
#             thresh, blackAndWhiteImage = cv2.threshold(grayImage, 0, 255, cv2.THRESH_OTSU | cv2.THRESH_BINARY_INV)
#
#             # Converting from array to image.
#             pil_img = Image.fromarray(blackAndWhiteImage)
#             pil_img.save("ImageBlackAndWhite/blackandwhiteImage.png")
#
#         except:
#             pil_img = Image.fromarray(originalImage)
#             pil_img.save("ImageBlackAndWhite/blackandwhiteImage.png")
#
#
#         url = uploadToFirebase("ImageBlackAndWhite/blackandwhiteImage.png")
#         return JsonResponse(url, safe=False)
#
#     # Converting the image to black and white
#     @staticmethod
#     def OpenCVImageThresholding(params):
#         firebaseImage = params['url']
#         try:
#             thresholdType = params['threshold']
#         except:
#             thresholdType = "BINARY"
#
#         # Reading the image with the help of OpenCV method.
#         originalImage = skimage.io.imread(firebaseImage)
#
#         try:
#             # Converting the color image to grayscale image.
#             grayImage = cv2.cvtColor(originalImage, cv2.COLOR_BGR2GRAY)
#
#             ret, thresh = cv2.threshold(grayImage, 127, 255, openCVThresholdTypes[thresholdType])
#
#             # Converting from array to image.
#             pil_img = Image.fromarray(thresh)
#             pil_img.save("ImageThresholding/thresholdingImage.png")
#
#         except:
#             pil_img = Image.fromarray(originalImage)
#             pil_img.save("ImageThresholding/thresholdingImage.png")
#
#
#         url = uploadToFirebase("ImageThresholding/thresholdingImage.png")
#         return JsonResponse(url, safe=False)
#
#     # Annotating text on the image
#     @staticmethod
#     def OpenCVTextDetection(params):
#         firebaseImage = params['url']
#
#         # Define the binary file path of tesseract as shown below.
#         path_to_tesseract = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
#         pytesseract.tesseract_cmd = path_to_tesseract
#
#         # Reading the image with the help of OpenCV method.
#         originalImage = skimage.io.imread(firebaseImage)
#
#         try:
#             # Converting the color image to grayscale image for better text processing.
#             gray = cv2.cvtColor(originalImage, cv2.COLOR_BGR2GRAY)
#
#             # Convert the grayscale image to binary image to enhance the chance of text extracting.
#             ret, thresh1 = cv2.threshold(gray, 0, 255, cv2.THRESH_OTSU | cv2.THRESH_BINARY_INV)
#             # cv2.imwrite('ImageTextDetection/threshold_image.jpg', thresh1)
#
#             # Use a structure element method in OpenCV with the kernel size depending upon the area of the text.
#             rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (12, 12))
#
#             # Use the dilation method on the binary image to get the boundaries of the text.
#             dilation = cv2.dilate(thresh1, rect_kernel, iterations=3)
#             # cv2.imwrite('ImageTextDetection/dilation_image.jpg', dilation)
#
#             # Use the find contour method to get the area of the white pixels.
#             contours, hierarchy = cv2.findContours(dilation, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
#
#             # To do some operations on the image, copy it to another variable.
#             im2 = originalImage.copy()
#
#             # Getting the coordinates of the white pixel area and draw the bounding box around it.
#             for cnt in contours:
#                 x, y, w, h = cv2.boundingRect(cnt)
#
#                 # Draw the bounding box on the text area
#                 rect = cv2.rectangle(im2, (x, y), (x + w, y + h), (0, 255, 0), 2)
#
#                 # Crop the bounding box area
#                 cropped = im2[y:y + h, x:x + w]
#
#                 cv2.imwrite('ImageTextDetection/rectanglebox.jpg', rect)
#
#                 # Open the text file
#                 file = open("ImageTextDetection/text_output.txt", "a")
#
#                 # Using tesseract on the cropped image area to get text
#                 text = pytesseract.image_to_string(cropped)
#
#                 # Adding the text to the file
#                 file.write(text)
#                 file.write("\n")
#
#                 # Closing the file
#                 file.close()
#
#             rectangleboxImage = cv2.imread('ImageTextDetection/rectanglebox.jpg')
#
#             # Converting from array to image.
#             pil_img = Image.fromarray(rectangleboxImage)
#             pil_img.save("ImageTextDetection/rectangleboxImage.png")
#
#         except:
#             # Convert the grayscale image to binary image to enhance the chance of text extracting.
#             ret, thresh1 = cv2.threshold(originalImage, 0, 255, cv2.THRESH_OTSU | cv2.THRESH_BINARY_INV)
#             # cv2.imwrite('ImageTextDetection/threshold_image.jpg', thresh1)
#
#             # Use a structure element method in OpenCV with the kernel size depending upon the area of the text.
#             rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (12, 12))
#
#             # Use the dilation method on the binary image to get the boundaries of the text.
#             dilation = cv2.dilate(thresh1, rect_kernel, iterations=3)
#             # cv2.imwrite('ImageTextDetection/dilation_image.jpg', dilation)
#
#             # Use the find contour method to get the area of the white pixels.
#             contours, hierarchy = cv2.findContours(dilation, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
#
#             # To do some operations on the image, copy it to another variable.
#             im2 = originalImage.copy()
#
#             # Getting the coordinates of the white pixel area and draw the bounding box around it.
#             for cnt in contours:
#                 x, y, w, h = cv2.boundingRect(cnt)
#
#                 # Draw the bounding box on the text area
#                 rect = cv2.rectangle(im2, (x, y), (x + w, y + h), (0, 255, 0), 2)
#
#                 # Crop the bounding box area
#                 cropped = im2[y:y + h, x:x + w]
#
#                 cv2.imwrite('ImageTextDetection/rectanglebox.jpg', rect)
#
#                 # Open the text file
#                 file = open("ImageTextDetection/text_output.txt", "a")
#
#                 # Using tesseract on the cropped image area to get text
#                 text = pytesseract.image_to_string(cropped)
#
#                 # Adding the text to the file
#                 file.write(text)
#                 file.write("\n")
#
#                 # Closing the file
#                 file.close()
#
#             rectangleboxImage = cv2.imread('ImageTextDetection/rectanglebox.jpg')
#
#             # Converting from array to image.
#             pil_img = Image.fromarray(rectangleboxImage)
#             pil_img.save("ImageTextDetection/rectangleboxImage.png")
#
#
#         url = uploadToFirebase("ImageTextDetection/rectangleboxImage.png")
#         os.remove("ImageTextDetection/text_output.txt")
#         return JsonResponse(url, safe=False)
#
#
# openCVFunctions = {
#     "GrayImage": CVFunctions.OpenCVGrayImage,
#     "ImageThresholding": CVFunctions.OpenCVImageThresholding,
#     "TextDetection": CVFunctions.OpenCVTextDetection
# }
#
# openCVThresholdTypes = {
#     "BINARY": cv2.THRESH_BINARY,
#     "BINARY_INV": cv2.THRESH_BINARY_INV,
#     "TRUNC": cv2.THRESH_TRUNC,
#     "TOZERO": cv2.THRESH_TOZERO,
#     "TOZERO_INV": cv2.THRESH_TOZERO_INV
# }
