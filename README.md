# IVIS-CORE
## Introduction 
IVIS-CORE project provides core components, and modules in order to develop and realize modern Web applications for data visualization, and analytics.

IVIS is a framework built on Node.js (for server-side) and ReactJS (for client side). It uses mysql for long-term data storage and ElasticSearch for complex queries over time-series data. On the client, it uses the D3 library to build complex fully custom interactive visualizations.

In particular, this project offers the visualization components (LineChart, AreaChart, OnOffAreaChart, PieChart) and other core functionalities at the client- and the server-side for the development of domain-specific applications through IVIS extensions.

## Structure
This project consists of the client-, and the server-side modules. The client module provides all components (UI components, visualization), libraries, etc. that will be presented to the users of Web applications through Web browsers. While the server-side module provides all components, services, and libraries to operate security, database, searching, indexing, etc.

## Technologies
IVIS-CORE has been realized on top of several technologies, in particular based on JavaScript ecosystem, as the following:

- Frontend: 
-- User Interface: Reactjs (a javascript library)
-- User Interface Design: bootstrap
-- Visualizations: D3 (a javascript library)
-- JSX:
- Backend:
-- IVIS routes, and API: NodeJS
-- Database: MySQL
-- Indexing & Searching: ElasticSearch
-- Security: Passport


## Quick Start

### Preparation
The project creates three URL endpoints, which are referred to as "trusted", "sandbox" and "public". This allows Mailtrain
to guarantee security and avoid XSS attacks in the multi-user settings. The function of these three endpoints is as follows:
- *trusted* - This is the main endpoint for the UI that a logged-in user uses to manage lists, send campaigns, etc.
- *sandbox* - This is an endpoint not directly visible to a user. It is used to host user-defined panels.
- *API* - This is an endpoint for subscribers. It is used to host subscription management forms, files and archive.

The recommended deployment of IVIS is to use 3 DNS entries that all points to the **same** IP address. For example as follows:
- *ivis.example.com* - trusted endpoint (A record `ivis` under `example.com` domain)
- *sbox.ivis.example.com* - sandbox endpoint (CNAME record `sbox.ivis` under `example.com` domain that points to `ivis`)
- *api.ivis.example.com* - public endpoint (CNAME record `api.ivis` under `example.com` domain that points to `ivis`)


### Installation on fresh CentOS 7 or Ubuntu 18.04 LTS (public website secured by SSL)

This will setup a publicly accessible Mailtrain instance. Endpoints trusted and sandbox will provide both HTTP (on port 80)
and HTTPS (on port 443). The HTTP ports just issue HTTP redirect to their HTTPS counterparts. The API endpoit will be 
available only via HTTPS. 

The script below will also acquire a valid certificate from [Let's Encrypt](https://letsencrypt.org/).
If you are hosting Mailtrain on AWS or some other cloud provider, make sure that **before** running the installation
script you allow inbound connection to ports 80 (HTTP) and 443 (HTTPS).

**Note,** that this will automatically accept the Let's Encrypt's Terms of Service.
Thus, by running this script below, you agree with the Let's Encrypt's Terms of Service (https://letsencrypt.org/documents/LE-SA-v1.2-November-15-2017.pdf).



1. Login as root. (We had some problems running npm as root on CentOS 7 on AWS. This seems to be fixed by the seemingly extraneous `su` within `sudo`.)
    ```
    sudo su -
    ```

2. Install GIT

   For Centos 7 type:
    ```
    yum install -y git
    ```

   For Ubuntu 18.04 LTS type
    ```
    apt-get install -y git
    ```

3. Download IVIS using git to the `/opt/ivis-core` directory
    ```
    cd /opt
    git clone https://github.com/smartarch/ivis-core.git
    cd ivis-core
    ```

4. Run the installation script. Replace the urls and your email address with the correct values. **NOTE** that running this script you agree
   Let's Encrypt's conditions.

   For Centos 7 type:
    ```
    bash setup/install-centos7-https.sh ivis.example.com sbox.ivis.example.com api.ivis.example.com admin@example.com
    ```

   For Ubuntu 18.04 LTS type:
    ```
    bash setup/install-ubuntu1804-https.sh ivis.example.com sbox.ivis.example.com api.ivis.example.com admin@example.com
    ```

5. Start Mailtrain and enable to be started by default when your server starts.
    ```
    systemctl start ivis-core
    systemctl enable ivis-core
    ```

6. Open the trusted endpoint (like `https://ivis.example.com`)

7. Authenticate as `admin`:`test`

8. Update your password under Account/Profile



### Installation on fresh CentOS 7 or Ubuntu 18.04 LTS (local installation)

This will setup a locally accessible IVIS instance (primarily for development and testing).
All endpoints (trusted, sandbox, public) will provide only HTTP as follows:
- http://localhost:8080 - trusted endpoint
- http://localhost:8081 - sandbox endpoint
- http://localhost:8082 - api endpoint

1. Login as root. (We had some problems running npm as root on CentOS 7 on AWS. This seems to be fixed by the seemingly extraneous `su` within `sudo`.)
    ```
    sudo su -
    ```

2. Install GIT

   For Centos 7 type:
    ```
    yum install -y git
    ```

   For Ubuntu 18.04 LTS type
    ```
    apt-get install -y git
    ```

3. Download IVIS using git to the `/opt/ivis-core` directory
    ```
    cd /opt
    git clone https://github.com/smartarch/ivis-core.git
    cd ivis-core
    ```

4. Run the installation script.

   For Centos 7 type:
    ```
    bash setup/install-centos7-local.sh
    ```

   For Ubuntu 18.04 LTS type:
    ```
    bash setup/install-ubuntu1804-local.sh
    ```

5. Start Mailtrain and enable to be started by default when your server starts.
    ```
    systemctl start ivis-core
    systemctl enable ivis-core
    ```

6. Open the trusted endpoint (like `http://localhost:3000`)

7. Authenticate as `admin`:`test`

8. Update your password under Account/Profile




## License

  **MIT**
