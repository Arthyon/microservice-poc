using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace gateway
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateWebHostBuilder(args).Build().Run();
        }

        public static IWebHostBuilder CreateWebHostBuilder(string[] args) =>
            WebHost.CreateDefaultBuilder(args)
            .ConfigureAppConfiguration(LoadConfigurationFromFile)
            .UseStartup<Startup>();

        static void LoadConfigurationFromFile(WebHostBuilderContext ctx, IConfigurationBuilder config)
        {
            config
                // .AddJsonFile($"ocelot.{ctx.HostingEnvironment.EnvironmentName}.json")
                .AddJsonFile("ocelot.json")
                .AddEnvironmentVariables();
        }
    }
}