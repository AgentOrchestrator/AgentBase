# macOS Traffic Light Buttons as SVG

In case it's handy for your app to emulate macOS's "traffic light" buttons, here's a flat graphical approximation of them in SVG format.

Apple calls them ["window control buttons (Close, Minimize, and Zoom)"](https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/), and officially they call the middle one 'yellow', not orange.

This SVG approximation is not perfect. The real ones in the system seem to have anti-aliasing and transparency applied to the edges or the inner symbols.

If there is official documentation or files of the original graphics or code in the macOS system, I'm happy to make this better if someone brings it to my attention. Anyone welcome to help contribute to make these better.

This set doesn't currently include all known visual states of the buttons. (the 'plus' alt symbol for green button, and circle dot for an open window whose file has unsaved changes.) I may add them later, if you want them now make a request or submit a pull request for me to consider.

Also not here a cool pure CSS emulation:

https://gist.github.com/merqurio/4e17987b8515d44141e5952c55591869<br>
https://codepen.io/atdrago/pen/yezrBR

---

My reference of my attempt to get the colors right as well as I can:

nofocus fill: dddddd
<br>nofocus border: d1d0d2

red normal fill: ed6a5f
<br>red normal border: e24b41
<br>red hover symbol: 460804 (approx.)
<br>red pressed fill: b15048
<br>red pressed border: a14239
<br>red pressed symbol: 170101

yellow normal fill: f6be50
<br>yellow normal border: e1a73e
<br>yellow hover symbol: 90591d (approx.)
<br>yellow pressed fill: b8923b
<br>yellow pressed border: a67f36
<br>yellow pressed symbol: 532a0a

green normal fill: 61c555
<br>green normal border: 2dac2f
<br>green hover symbol: 2a6218 (approx.)
<br>green pressed fill: 4a9741
<br>green pressed border: 428234
<br>green pressed symbol: 113107

---

These images originally adapted in part from a set created by synetcon at https://www.deviantart.com/synetcon/art/OSX-Yosemite-window-buttons-459868391. License of those files are Creative Commons Attribution 3.0 License (https://creativecommons.org/licenses/by/3.0/).
