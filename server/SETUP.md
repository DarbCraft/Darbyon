# Running DårbCRÅFT on a Raspberry Pi

This puts the class site on a Raspberry Pi so every device on the same network
sees the same class. Students can view Home and Teams. Changing anything needs
the teacher password.

## Before you start

**Talk to your school's IT person first.** Ask them three things:

1. May I plug a Raspberry Pi into the school network (by cable is easiest)?
2. Can student devices reach it? Many school networks stop devices talking to each other.
3. Can it be given an address that never changes (a "reserved" or "static" IP address)?

If the answer to 1 or 2 is no, the Pi cannot be used at school and you should stop here.

You need:

- Raspberry Pi 4 with its power supply
- A microSD card, 16 GB or larger
- A network cable (school Wi-Fi that asks for a username and password is hard to set up on a Pi)
- A computer with a card reader, for step 1

## 1. Put the operating system on the card

1. On your computer, install **Raspberry Pi Imager** from raspberrypi.com/software.
2. Choose your device (**Raspberry Pi 4**), the operating system
   **Raspberry Pi OS Lite (64-bit)** (it is under "Raspberry Pi OS (other)"), and your microSD card.
3. When Imager offers to customise the settings, set:
   - **Hostname:** `darbyon`
   - **Username and password:** your choice. This is the login for the Pi itself, not the site. Write it down.
   - **SSH:** turned on, using password login.
   - **Wi-Fi:** leave empty if you are using a cable.
4. Write the card, put it in the Pi, plug in the network cable, then the power. Wait two minutes.

## 2. Log in to the Pi

On your computer, open **Terminal** (Mac) or **PowerShell** (Windows) and type,
using the username you chose:

    ssh yourusername@darbyon.local

Type `yes` if asked whether to trust it, then your Pi password. Nothing shows
while you type the password; that is normal.

If `darbyon.local` is not found, ask IT for the Pi's IP address and use that
instead, for example `ssh yourusername@10.1.2.3`.

## 3. Install the site

Copy these lines in one at a time, pressing Enter after each:

    sudo apt update && sudo apt full-upgrade -y
    sudo apt install -y git
    git clone https://github.com/DarbCraft/Darbyon.git
    cd Darbyon
    sudo bash server/install.sh

The last line asks you to choose the **teacher password** for the site (at
least 8 characters, and not one you use anywhere else). It then starts the
site and prints its address, such as `http://darbyon.local`.

## 4. Move your class across

1. On the computer you have been running the class from, open the old site,
   go to **Settings** and click **Download Backup**.
2. On the same computer, open the Pi's address, click **Teacher Login**, and log in.
3. Go to **Settings**, click **Restore from Backup…** and choose the file you just downloaded.

Your students, teams, powers, news and punishments are now on the Pi.

## Everyday use

- **You:** open the Pi's address, click **Teacher Login**. You stay logged in for 12 hours on that browser.
- **Students:** open the same address. They see Home and Teams, which update by themselves every 10 seconds.
- **Projector:** Home and Teams also update by themselves there. Log in on that browser if you want the random picker.
- The Pi can be switched off at the wall and on again; the site starts by itself.

## Backups

- The Pi keeps a copy of the class for each of the last 14 days in
  `Darbyon/server/data/backups`.
- If the Pi's card ever fails those copies go with it, so still click
  **Download Backup** on the Settings page now and then and keep the file on your own computer.
- Never upload a backup file to GitHub. Your repository is public and the file contains student names.

## Updating the site later

After new files are uploaded to GitHub, log in to the Pi (step 2) and run:

    cd Darbyon
    git pull
    sudo systemctl restart darbyon

Your class data is not touched by an update.

## If something goes wrong

| Problem | What to do |
|---|---|
| The address does not open | Check the Pi has power and its cable. Try its IP address instead of `darbyon.local`. |
| It opens on your computer but not on student devices | The school network is blocking it. This needs IT. |
| "Cannot reach the server" banner | The Pi is off or unplugged. Your change is sent as soon as it comes back, if you leave the page open. |
| Forgot the teacher password | Log in to the Pi and run `cd Darbyon && python3 server/server.py --set-password` |
| "Too many wrong passwords" | Wait five minutes. |
| See what the server is doing | `sudo journalctl -u darbyon -n 50` |

## What to know about privacy

- The site is only reachable from inside the school network. Nothing is sent to the internet.
- Anyone on that network who knows the address can see student names and scores without logging in.
- The site uses plain `http`, so the teacher password is not encrypted as it
  crosses the school network. Use a password you do not use for anything else.
