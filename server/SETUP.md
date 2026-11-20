# Running DårbCRÅFT on a Raspberry Pi

This puts the class site on a Raspberry Pi so every device sees the same class.
There are two ways to run it. This guide covers the first in full.

| | A. At home, through the internet | B. On the school network |
|---|---|---|
| Where the Pi lives | Your home, on your home Wi-Fi | At school, plugged into the school network |
| How students reach it | A web address that works anywhere | An address that only works inside the school |
| Needs | A free Tailscale account | Permission from school IT |
| Who can view the class | Anyone with the class code | Anyone on the school network |

In both, changing anything needs the teacher password.

---

# A. At home, through the internet

## What will be online

- Each student's name, class, avatar, team and scores, visible only after typing the class code.
- Nothing else. The change log, punishments and settings need the teacher password.

**Use hero names, not real names.** If students pick a made-up name ("Shadowfox"),
nothing on the site identifies a real child. Keep your own list of who is who.
Check with your school before putting students' real first names online.

## You need

- Raspberry Pi 4 with its power supply
- A microSD card, 16 GB or larger, and a computer with a card reader
- Your home Wi-Fi name and password

## 1. Put the operating system on the card

1. On your computer, install **Raspberry Pi Imager** from raspberrypi.com/software.
2. Choose your device (**Raspberry Pi 4**), the operating system
   **Raspberry Pi OS Lite (64-bit)** (under "Raspberry Pi OS (other)"), and your microSD card.
3. On the customisation screens set:
   - **Hostname:** `darbyon`
   - **Localisation:** Wi-Fi country Australia (AU)
   - **User:** a short lowercase username such as `lachie`, and a password. This logs in to the Pi itself. Write both down.
   - **Wi-Fi:** your home network's name, exactly as it appears in your Wi-Fi list, and its password
   - **Remote access:** SSH on, password authentication
   - **Raspberry Pi Connect:** off
4. Write the card, put it in the Pi and plug in the power. Wait five minutes.

## 2. Log in to the Pi

With your computer on the same home Wi-Fi, open **Terminal** and type, using your Pi username:

    ssh lachie@darbyon.local

Type `yes` if asked whether to trust it, then your Pi password. Nothing shows while you type it.

## 3. Install the site

Copy these in one at a time:

    sudo apt update && sudo apt full-upgrade -y
    sudo apt install -y git
    git clone https://github.com/DarbCraft/Darbyon.git
    cd Darbyon
    sudo bash server/install.sh internet

The last line asks you to choose two things:

- **Teacher password:** at least 12 characters, and not one you use anywhere else.
  Three or four random words works well. This is the only thing between the
  internet and your class, so make it a good one.
- **Class code:** at least 6 characters. This is what students type to see the class.

## 4. Put it on the internet with Tailscale

Tailscale is a free service that gives the Pi a secure `https` web address
without changing anything on your home router.

1. Install it and sign in:

       curl -fsSL https://tailscale.com/install.sh | sh
       sudo tailscale up

   The second line prints a web link. Open it on your computer and sign in
   (a Google, Microsoft, GitHub or Apple account all work).

2. Publish the site:

       sudo tailscale funnel --bg 8080

   The first time, this prints another link asking you to approve "Funnel".
   Approve it, then run the same line again.

3. It prints your address, which looks like `https://darbyon.something.ts.net`.
   A new address can take up to ten minutes to start working.

That address is what you and your students use from now on.

## 5. Move your class across

1. On the computer you have been running the class from, open the old site,
   go to **Settings** and click **Download Backup**.
2. Open the new address, click **Teacher Login** and log in.
3. Go to **Settings**, click **Restore from Backup…** and choose the file.

## 6. Check it from school

Before telling students, open the address on a student device on the school
Wi-Fi. School web filters sometimes block unfamiliar addresses. If it is
blocked, ask IT to allow that one address.

## Everyday use

- **You:** open the address, click **Teacher Login**. You stay logged in for 12 hours.
- **Students:** open the address and type the class code once. Their device remembers it for a month.
  They see Home and Teams, which update by themselves every 10 seconds.
- Leave the Pi switched on. If the power goes off, the site starts by itself when it comes back.

## Changing the codes

Log in to the Pi (step 2), then:

    cd Darbyon
    python3 server/server.py --set-class-code     # students must type the new code
    python3 server/server.py --set-password       # logs the teacher out everywhere

## Backups

- The Pi keeps a copy of the class for each of the last 14 days in `Darbyon/server/data/backups`.
- If the Pi's card fails those copies go with it, so click **Download Backup**
  on Settings now and then and keep the file on your own computer.
- Never upload a backup file to GitHub. Your repository is public.

## Updating the site later

After new files are uploaded to GitHub, log in to the Pi and run:

    cd Darbyon
    git pull
    sudo systemctl restart darbyon

Your class data is not touched by an update.

## Taking it offline

    sudo tailscale funnel reset

The site keeps running on the Pi but can no longer be reached from the internet.

## If something goes wrong

| Problem | What to do |
|---|---|
| `ssh` just waits | The Pi is not on your Wi-Fi. Check the Wi-Fi name and password in Imager and write the card again. |
| The address does not open at all | Wait ten minutes after first setting it up. Check the Pi has power. Log in and run `sudo tailscale funnel status`. |
| The address stopped working after a power cut | Log in and run `sudo tailscale funnel --bg 8080` again. |
| It opens at home but not at school | The school filter is blocking it. Ask IT to allow the address. |
| "Cannot reach the server" banner | The Pi or your home internet is down. Your change is sent when it comes back, if you leave the page open. |
| "Too many wrong tries" | Wait five minutes. |
| "The site is busy" when logging in | Someone is guessing passwords. Wait a moment and try again; your class is not affected. |
| Forgot the teacher password | Log in to the Pi and set a new one (see "Changing the codes"). |
| See what the server is doing | `sudo journalctl -u darbyon -n 50` |

## What protects the class

- The address uses `https`, so passwords and the class are encrypted in transit.
- Nothing about the class is shown until the class code is typed.
- A device that guesses wrong five times is locked out for five minutes.
- The site asks search engines not to list it.
- This server was written for this project and tested, but it has not had an
  independent security review. That is the reason to keep real names off it.

---

# B. On the school network

Use this only if school IT agrees that the Pi may be plugged in, that student
devices can reach it, and that it can keep the same address.

Follow steps 1 to 3 above, with two changes:

- In Imager, leave Wi-Fi empty and connect the Pi to the school network by cable.
- For the last line of step 3, run `sudo bash server/install.sh` (without `internet`).

It prints an address such as `http://darbyon.local`. Skip step 4. Things to know:

- The site only works inside the school network.
- Without a class code, anyone on that network who has the address can view the
  class. To require one, run `python3 server/server.py --set-class-code`.
- It uses plain `http`, so the teacher password is not encrypted on the school network.
