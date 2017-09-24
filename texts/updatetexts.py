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
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),  "textos", "convert")
    buildFile = os.path.join(path, "convert.py")
    call(["python", buildFile])
    
    dstParent = os.path.dirname(os.path.abspath(__file__))
    src = os.path.join(path, "epub")
    dst = os.path.join(dstParent, "epub")
    if os.path.exists(dst):
        shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(src, dst)
    src = os.path.join(path, "html")
    dst = os.path.join(dstParent, "html")
    if os.path.exists(dst):
        shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(src, dst)    

    call("git add .".split(" "))
    call("git commit -m update".split(" "))
    call("git push".split(" "))    

if __name__ == '__main__':  
    buildAndCopy()
