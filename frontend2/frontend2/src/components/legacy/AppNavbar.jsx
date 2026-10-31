import { NavLink } from "react-router-dom";

const AppNavbar = () => {
    return (
        <>
            <nav className="bg-white border-gray-200 dark:bg-gray-900">
                <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl p-4">
                    <NavLink
                        to={"/"}
                        className="flex items-center space-x-3 rtl:space-x-reverse 
                         relative   overflow-hidden  "
                    >
                        <img src="data:image/png;base64,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"
                            className="h-8
                             relative z-0 rounded-lg transition-all duration-300 hover:scale-110"
                            alt=" Logo"
                        />
                        <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white
                         hover:text-neutral-700 focus:text-neutral-700  dark:text-neutral-200 dark:hover:text-neutral-300 dark:focus:text-neutral-300 lg:px-2 [&.active]:text-black/90 dark:[&.active]:text-zinc-400
                        ">
                            KMRL Train Dashboard
                        </span>
                    </NavLink>
                    <div className="flex items-center space-x-6 rtl:space-x-reverse">
                        <a
                            href="####"
                            className="text-sm text-gray-500 dark:text-white hover:underline
                              hover:text-neutral-700 focus:text-neutral-700  dark:text-neutral-200 dark:hover:text-neutral-300 dark:focus:text-neutral-300 lg:px-2 [&.active]:text-black/90 dark:[&.active]:text-zinc-400
                            "
                        >
                            AI Objective Score: N/A
                        </a>
                        <a
                            href="#"
                            className="text-sm text-blue-600 dark:text-blue-500 hover:underline"
                        >

                        </a>
                    </div>
                </div>
            </nav>

            <nav className="bg-gray-50 dark:bg-gray-700">
                <div className="max-w-screen-xl px-4 py-3 mx-auto">
                    <div className="flex items-center">
                        <ul className="flex flex-row font-medium mt-0 space-x-8 rtl:space-x-reverse text-sm">
                            <li>
                                <NavLink
                                    to={"/"}
                                    className="relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-red-200 via-red-300 to-yellow-200 group-hover:from-red-200 group-hover:via-red-300 group-hover:to-yellow-200 dark:text-white dark:hover:text-gray-900 focus:ring-4 focus:outline-none focus:ring-red-100 dark:focus:ring-red-400
                                    text-gray-900 dark:text-white hover:underline
                                     mx-auto w-32 h-10 bg-indigo-300 cursor-pointer hover:bg-gradient-to-t from-indigo-300 via-indigo-400 to-indigo-500 transition-all duration-300 ease-in-out flex justify-center items-center"
                                    aria-current="page" >
                                    <span class="relative px-5 py-2.5 transition-all ease-in duration-75   rounded-md group-hover:bg-transparent group-hover:dark:bg-transparent">
                                        Home
                                    </span>

                                </NavLink>
                            </li>

                            <li>
                                <NavLink to={"./assignments"}
                                    className="relative inline-flex items-center justify-center py-5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-red-200 via-red-300 to-yellow-200 group-hover:from-red-200 group-hover:via-red-300 group-hover:to-yellow-200 dark:text-white dark:hover:text-gray-900 focus:ring-4 focus:outline-none focus:ring-red-100 dark:focus:ring-red-400
                                    text-gray-900 dark:text-white hover:underline
                                     mx-auto w-62 h-8 bg-indigo-300 cursor-pointer hover:bg-gradient-to-t from-indigo-300 via-indigo-400 to-indigo-500 transition-all duration-300 ease-in-out flex justify-center items-center"
                                    aria-current="page">
                                    <span class="relative px-5 py-2.5 transition-all ease-in duration-75   rounded-md group-hover:bg-transparent group-hover:dark:bg-transparent">
                                        AI Optimized Assignments
                                    </span>

                                </NavLink>
                            </li>

                            <li>
                                <NavLink
                                    to={"/charts"}
                                    className="relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-red-200 via-red-300 to-yellow-200 group-hover:from-red-200 group-hover:via-red-300 group-hover:to-yellow-200 dark:text-white dark:hover:text-gray-900 focus:ring-4 focus:outline-none focus:ring-red-100 dark:focus:ring-red-400
                                    text-gray-900 dark:text-white hover:underline
                                     mx-auto w-32 h-10 bg-indigo-300 cursor-pointer hover:bg-gradient-to-t from-indigo-300 via-indigo-400 to-indigo-500 transition-all duration-300 ease-in-out flex justify-center items-center"
                                    aria-current="page" >
                                    <span class="relative px-5 py-2.5 transition-all ease-in duration-75   rounded-md group-hover:bg-transparent group-hover:dark:bg-transparent">
                                        Charts
                                    </span>

                                </NavLink>
                            </li>

                            <li>
                                {/* <NavLink to={""} className="text-gray-900 dark:text-white hover:underline
                                  mx-auto w-32 h-10 bg-indigo-300 cursor-pointer hover:bg-gradient-to-t from-indigo-300 via-indigo-400 to-indigo-500 transition-all duration-300 ease-in-out flex justify-center items-center
                                ">
                                    Standby Trains 0
                                </NavLink> */}
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </>
    );
};

export default AppNavbar;