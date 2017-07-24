#!/usr/bin/python
# -*- coding: utf-8 -*-
import re
import os.path
import sys
import codecs 
import zipfile
import time
import shutil
from subprocess import call

def buildAndCopy():
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),  "textos", "convert")
    buildFile = os.path.join(path, "convert.py")
    call("python", buildFile)
    
    dstParent = os.path.dirname(__file__)
    src = os.path.join(path, "epub")
    dst = os.path.join("epub")
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    src = os.path.join(path, "html")
    dst = os.path.join("html")
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)    

    call("git", "commit", "-a", "-m", "updated site")
    call("git", "push")    

if __name__ == '__main__':  
    buildAndCopy()