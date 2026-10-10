import{g as Oe,s as We,p as Ne,o as Pe,a as Re,b as ze,_ as l,c as ht,d as Ve,aS as U,l as lt,j as He,n as qe,q as Be,y as Ge}from"./MermaidDiagram-1TI9I8-r.js";import{b2 as $t}from"./index-DL3opmCM.js";import{s as bt}from"./transform-Dc9ZRVI7.js";import{t as je,j as se,k as re,l as Xe,m as Ue,o as Ze,p as Qe,q as Ke,r as Je,v as ts,w as ie,x as ne,y as ae,s as oe,z as ce}from"./time-DoX1f-8e.js";import{m as es,a as ss}from"./min-tv6RD-6E.js";import{l as rs}from"./linear-CxV7Bzas.js";import{R as ye,r as is,q as ge,u as pe,C as ve,v as Lt,z as ns}from"./string-Dc_D6BOX.js";import{a as as,b as os}from"./axis-qL51v-F_.js";import"./purify.es-DBIK8olT.js";import"./bump-BTiDSYl1.js";import"./init-Dmth1JHB.js";import"./defaultLocale-Cw5pbRzx.js";import"./index-C0UdrJPs.js";const cs=Math.PI/180,ls=180/Math.PI,Et=18,xe=.96422,Te=1,be=.82521,we=4/29,mt=6/29,_e=3*mt*mt,us=mt*mt*mt;function De(t){if(t instanceof st)return new st(t.l,t.a,t.b,t.opacity);if(t instanceof it)return Se(t);t instanceof ye||(t=is(t));var e=Nt(t.r),r=Nt(t.g),s=Nt(t.b),n=At((.2225045*e+.7168786*r+.0606169*s)/Te),y,g;return e===r&&r===s?y=g=n:(y=At((.4360747*e+.3850649*r+.1430804*s)/xe),g=At((.0139322*e+.0971045*r+.7141733*s)/be)),new st(116*n-16,500*(y-n),200*(n-g),t.opacity)}function ds(t,e,r,s){return arguments.length===1?De(t):new st(t,e,r,s??1)}function st(t,e,r,s){this.l=+t,this.a=+e,this.b=+r,this.opacity=+s}ge(st,ds,pe(ve,{brighter(t){return new st(this.l+Et*(t??1),this.a,this.b,this.opacity)},darker(t){return new st(this.l-Et*(t??1),this.a,this.b,this.opacity)},rgb(){var t=(this.l+16)/116,e=isNaN(this.a)?t:t+this.a/500,r=isNaN(this.b)?t:t-this.b/200;return e=xe*Ot(e),t=Te*Ot(t),r=be*Ot(r),new ye(Wt(3.1338561*e-1.6168667*t-.4906146*r),Wt(-.9787684*e+1.9161415*t+.033454*r),Wt(.0719453*e-.2289914*t+1.4052427*r),this.opacity)}}));function At(t){return t>us?Math.pow(t,1/3):t/_e+we}function Ot(t){return t>mt?t*t*t:_e*(t-we)}function Wt(t){return 255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)}function Nt(t){return(t/=255)<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function fs(t){if(t instanceof it)return new it(t.h,t.c,t.l,t.opacity);if(t instanceof st||(t=De(t)),t.a===0&&t.b===0)return new it(NaN,0<t.l&&t.l<100?0:NaN,t.l,t.opacity);var e=Math.atan2(t.b,t.a)*ls;return new it(e<0?e+360:e,Math.sqrt(t.a*t.a+t.b*t.b),t.l,t.opacity)}function Rt(t,e,r,s){return arguments.length===1?fs(t):new it(t,e,r,s??1)}function it(t,e,r,s){this.h=+t,this.c=+e,this.l=+r,this.opacity=+s}function Se(t){if(isNaN(t.h))return new st(t.l,0,0,t.opacity);var e=t.h*cs;return new st(t.l,Math.cos(e)*t.c,Math.sin(e)*t.c,t.opacity)}ge(it,Rt,pe(ve,{brighter(t){return new it(this.h,this.c,this.l+Et*(t??1),this.opacity)},darker(t){return new it(this.h,this.c,this.l-Et*(t??1),this.opacity)},rgb(){return Se(this).rgb()}}));function hs(t){return function(e,r){var s=t((e=Rt(e)).h,(r=Rt(r)).h),n=Lt(e.c,r.c),y=Lt(e.l,r.l),g=Lt(e.opacity,r.opacity);return function(T){return e.h=s(T),e.c=n(T),e.l=y(T),e.opacity=g(T),e+""}}}const ms=hs(ns);var wt={exports:{}},ks=wt.exports,le;function ys(){return le||(le=1,(function(t,e){(function(r,s){t.exports=s()})(ks,(function(){var r="day";return function(s,n,y){var g=function(L){return L.add(4-L.isoWeekday(),r)},T=n.prototype;T.isoWeekYear=function(){return g(this).year()},T.isoWeek=function(L){if(!this.$utils().u(L))return this.add(7*(L-this.isoWeek()),r);var w,N,A,R,j=g(this),V=(w=this.isoWeekYear(),N=this.$u,A=(N?y.utc:y)().year(w).startOf("year"),R=4-A.isoWeekday(),A.isoWeekday()>4&&(R+=7),A.add(R,r));return j.diff(V,"week")+1},T.isoWeekday=function(L){return this.$utils().u(L)?this.day()||7:this.day(this.day()%7?L:L-7)};var F=T.startOf;T.startOf=function(L,w){var N=this.$utils(),A=!!N.u(w)||w;return N.p(L)==="isoweek"?A?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):F.bind(this)(L,w)}}}))})(wt)),wt.exports}var gs=ys();const ps=$t(gs);var _t={exports:{}},vs=_t.exports,ue;function xs(){return ue||(ue=1,(function(t,e){(function(r,s){t.exports=s()})(vs,(function(){var r={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},s=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,n=/\d/,y=/\d\d/,g=/\d\d?/,T=/\d*[^-_:/,()\s\d]+/,F={},L=function(k){return(k=+k)+(k>68?1900:2e3)},w=function(k){return function(E){this[k]=+E}},N=[/[+-]\d\d:?(\d\d)?|Z/,function(k){(this.zone||(this.zone={})).offset=(function(E){if(!E||E==="Z")return 0;var O=E.match(/([+-]|\d\d)/g),$=60*O[1]+(+O[2]||0);return $===0?0:O[0]==="+"?-$:$})(k)}],A=function(k){var E=F[k];return E&&(E.indexOf?E:E.s.concat(E.f))},R=function(k,E){var O,$=F.meridiem;if($){for(var X=1;X<=24;X+=1)if(k.indexOf($(X,0,E))>-1){O=X>12;break}}else O=k===(E?"pm":"PM");return O},j={A:[T,function(k){this.afternoon=R(k,!1)}],a:[T,function(k){this.afternoon=R(k,!0)}],Q:[n,function(k){this.month=3*(k-1)+1}],S:[n,function(k){this.milliseconds=100*+k}],SS:[y,function(k){this.milliseconds=10*+k}],SSS:[/\d{3}/,function(k){this.milliseconds=+k}],s:[g,w("seconds")],ss:[g,w("seconds")],m:[g,w("minutes")],mm:[g,w("minutes")],H:[g,w("hours")],h:[g,w("hours")],HH:[g,w("hours")],hh:[g,w("hours")],D:[g,w("day")],DD:[y,w("day")],Do:[T,function(k){var E=F.ordinal,O=k.match(/\d+/);if(this.day=O[0],E)for(var $=1;$<=31;$+=1)E($).replace(/\[|\]/g,"")===k&&(this.day=$)}],w:[g,w("week")],ww:[y,w("week")],M:[g,w("month")],MM:[y,w("month")],MMM:[T,function(k){var E=A("months"),O=(A("monthsShort")||E.map((function($){return $.slice(0,3)}))).indexOf(k)+1;if(O<1)throw new Error;this.month=O%12||O}],MMMM:[T,function(k){var E=A("months").indexOf(k)+1;if(E<1)throw new Error;this.month=E%12||E}],Y:[/[+-]?\d+/,w("year")],YY:[y,function(k){this.year=L(k)}],YYYY:[/\d{4}/,w("year")],Z:N,ZZ:N};function V(k){var E,O;E=k,O=F&&F.formats;for(var $=(k=E.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,(function(m,x,v){var p=v&&v.toUpperCase();return x||O[v]||r[v]||O[p].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,(function(a,d,f){return d||f.slice(1)}))}))).match(s),X=$.length,q=0;q<X;q+=1){var Y=$[q],b=j[Y],h=b&&b[0],I=b&&b[1];$[q]=I?{regex:h,parser:I}:Y.replace(/^\[|\]$/g,"")}return function(m){for(var x={},v=0,p=0;v<X;v+=1){var a=$[v];if(typeof a=="string")p+=a.length;else{var d=a.regex,f=a.parser,u=m.slice(p),_=d.exec(u)[0];f.call(x,_),m=m.replace(_,"")}}return(function(i){var D=i.afternoon;if(D!==void 0){var o=i.hours;D?o<12&&(i.hours+=12):o===12&&(i.hours=0),delete i.afternoon}})(x),x}}return function(k,E,O){O.p.customParseFormat=!0,k&&k.parseTwoDigitYear&&(L=k.parseTwoDigitYear);var $=E.prototype,X=$.parse;$.parse=function(q){var Y=q.date,b=q.utc,h=q.args;this.$u=b;var I=h[1];if(typeof I=="string"){var m=h[2]===!0,x=h[3]===!0,v=m||x,p=h[2];x&&(p=h[2]),F=this.$locale(),!m&&p&&(F=O.Ls[p]),this.$d=(function(u,_,i,D){try{if(["x","X"].indexOf(_)>-1)return new Date((_==="X"?1e3:1)*u);var o=V(_)(u),H=o.year,c=o.month,S=o.day,C=o.hours,P=o.minutes,M=o.seconds,z=o.milliseconds,W=o.zone,nt=o.week,ot=new Date,vt=S||(H||c?1:ot.getDate()),dt=H||ot.getFullYear(),B=0;H&&!c||(B=c>0?c-1:ot.getMonth());var K,Z=C||0,ct=P||0,J=M||0,at=z||0;return W?new Date(Date.UTC(dt,B,vt,Z,ct,J,at+60*W.offset*1e3)):i?new Date(Date.UTC(dt,B,vt,Z,ct,J,at)):(K=new Date(dt,B,vt,Z,ct,J,at),nt&&(K=D(K).week(nt).toDate()),K)}catch{return new Date("")}})(Y,I,b,O),this.init(),p&&p!==!0&&(this.$L=this.locale(p).$L),v&&Y!=this.format(I)&&(this.$d=new Date("")),F={}}else if(I instanceof Array)for(var a=I.length,d=1;d<=a;d+=1){h[1]=I[d-1];var f=O.apply(this,h);if(f.isValid()){this.$d=f.$d,this.$L=f.$L,this.init();break}d===a&&(this.$d=new Date(""))}else X.call(this,q)}}}))})(_t)),_t.exports}var Ts=xs();const bs=$t(Ts);var Dt={exports:{}},ws=Dt.exports,de;function _s(){return de||(de=1,(function(t,e){(function(r,s){t.exports=s()})(ws,(function(){return function(r,s){var n=s.prototype,y=n.format;n.format=function(g){var T=this,F=this.$locale();if(!this.isValid())return y.bind(this)(g);var L=this.$utils(),w=(g||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,(function(N){switch(N){case"Q":return Math.ceil((T.$M+1)/3);case"Do":return F.ordinal(T.$D);case"gggg":return T.weekYear();case"GGGG":return T.isoWeekYear();case"wo":return F.ordinal(T.week(),"W");case"w":case"ww":return L.s(T.week(),N==="w"?1:2,"0");case"W":case"WW":return L.s(T.isoWeek(),N==="W"?1:2,"0");case"k":case"kk":return L.s(String(T.$H===0?24:T.$H),N==="k"?1:2,"0");case"X":return Math.floor(T.$d.getTime()/1e3);case"x":return T.$d.getTime();case"z":return"["+T.offsetName()+"]";case"zzz":return"["+T.offsetName("long")+"]";default:return N}}));return y.bind(this)(w)}}}))})(Dt)),Dt.exports}var Ds=_s();const Ss=$t(Ds);var St={exports:{}},Cs=St.exports,fe;function Ms(){return fe||(fe=1,(function(t,e){(function(r,s){t.exports=s()})(Cs,(function(){var r,s,n=1e3,y=6e4,g=36e5,T=864e5,F=31536e6,L=2628e6,w=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,N=/\[([^\]]+)]|YYYY|YY|Y|M{1,2}|D{1,2}|H{1,2}|m{1,2}|s{1,2}|SSS/g,A={years:F,months:L,days:T,hours:g,minutes:y,seconds:n,milliseconds:1,weeks:6048e5},R=function(Y){return Y instanceof X},j=function(Y,b,h){return new X(Y,h,b.$l)},V=function(Y){return s.p(Y)+"s"},k=function(Y){return Y<0},E=function(Y){return k(Y)?Math.ceil(Y):Math.floor(Y)},O=function(Y){return Math.abs(Y)},$=function(Y,b){return Y?k(Y)?{negative:!0,format:""+O(Y)+b}:{negative:!1,format:""+Y+b}:{negative:!1,format:""}},X=(function(){function Y(h,I,m){var x=this;if(this.$d={},this.$l=m,h===void 0&&(this.$ms=0,this.parseFromMilliseconds()),I)return j(h*A[V(I)],this);if(typeof h=="number")return this.$ms=h,this.parseFromMilliseconds(),this;if(typeof h=="object")return Object.keys(h).forEach((function(a){x.$d[V(a)]=h[a]})),this.calMilliseconds(),this;if(typeof h=="string"){var v=h.match(w);if(v){var p=v.slice(2).map((function(a){return a!=null?Number(a):0}));return this.$d.years=p[0],this.$d.months=p[1],this.$d.weeks=p[2],this.$d.days=p[3],this.$d.hours=p[4],this.$d.minutes=p[5],this.$d.seconds=p[6],this.calMilliseconds(),this}}return this}var b=Y.prototype;return b.calMilliseconds=function(){var h=this;this.$ms=Object.keys(this.$d).reduce((function(I,m){return I+(h.$d[m]||0)*A[m]}),0)},b.parseFromMilliseconds=function(){var h=this.$ms;this.$d.years=E(h/F),h%=F,this.$d.months=E(h/L),h%=L,this.$d.days=E(h/T),h%=T,this.$d.hours=E(h/g),h%=g,this.$d.minutes=E(h/y),h%=y,this.$d.seconds=E(h/n),h%=n,this.$d.milliseconds=h},b.toISOString=function(){var h=$(this.$d.years,"Y"),I=$(this.$d.months,"M"),m=+this.$d.days||0;this.$d.weeks&&(m+=7*this.$d.weeks);var x=$(m,"D"),v=$(this.$d.hours,"H"),p=$(this.$d.minutes,"M"),a=this.$d.seconds||0;this.$d.milliseconds&&(a+=this.$d.milliseconds/1e3,a=Math.round(1e3*a)/1e3);var d=$(a,"S"),f=h.negative||I.negative||x.negative||v.negative||p.negative||d.negative,u=v.format||p.format||d.format?"T":"",_=(f?"-":"")+"P"+h.format+I.format+x.format+u+v.format+p.format+d.format;return _==="P"||_==="-P"?"P0D":_},b.toJSON=function(){return this.toISOString()},b.format=function(h){var I=h||"YYYY-MM-DDTHH:mm:ss",m={Y:this.$d.years,YY:s.s(this.$d.years,2,"0"),YYYY:s.s(this.$d.years,4,"0"),M:this.$d.months,MM:s.s(this.$d.months,2,"0"),D:this.$d.days,DD:s.s(this.$d.days,2,"0"),H:this.$d.hours,HH:s.s(this.$d.hours,2,"0"),m:this.$d.minutes,mm:s.s(this.$d.minutes,2,"0"),s:this.$d.seconds,ss:s.s(this.$d.seconds,2,"0"),SSS:s.s(this.$d.milliseconds,3,"0")};return I.replace(N,(function(x,v){return v||String(m[x])}))},b.as=function(h){return this.$ms/A[V(h)]},b.get=function(h){var I=this.$ms,m=V(h);return m==="milliseconds"?I%=1e3:I=m==="weeks"?E(I/A[m]):this.$d[m],I||0},b.add=function(h,I,m){var x;return x=I?h*A[V(I)]:R(h)?h.$ms:j(h,this).$ms,j(this.$ms+x*(m?-1:1),this)},b.subtract=function(h,I){return this.add(h,I,!0)},b.locale=function(h){var I=this.clone();return I.$l=h,I},b.clone=function(){return j(this.$ms,this)},b.humanize=function(h){return r().add(this.$ms,"ms").locale(this.$l).fromNow(!h)},b.valueOf=function(){return this.asMilliseconds()},b.milliseconds=function(){return this.get("milliseconds")},b.asMilliseconds=function(){return this.as("milliseconds")},b.seconds=function(){return this.get("seconds")},b.asSeconds=function(){return this.as("seconds")},b.minutes=function(){return this.get("minutes")},b.asMinutes=function(){return this.as("minutes")},b.hours=function(){return this.get("hours")},b.asHours=function(){return this.as("hours")},b.days=function(){return this.get("days")},b.asDays=function(){return this.as("days")},b.weeks=function(){return this.get("weeks")},b.asWeeks=function(){return this.as("weeks")},b.months=function(){return this.get("months")},b.asMonths=function(){return this.as("months")},b.years=function(){return this.get("years")},b.asYears=function(){return this.as("years")},Y})(),q=function(Y,b,h){return Y.add(b.years()*h,"y").add(b.months()*h,"M").add(b.days()*h,"d").add(b.hours()*h,"h").add(b.minutes()*h,"m").add(b.seconds()*h,"s").add(b.milliseconds()*h,"ms")};return function(Y,b,h){r=h,s=h().$utils(),h.duration=function(x,v){var p=h.locale();return j(x,{$l:p},v)},h.isDuration=R;var I=b.prototype.add,m=b.prototype.subtract;b.prototype.add=function(x,v){return R(x)?q(this,x,1):I.bind(this)(x,v)},b.prototype.subtract=function(x,v){return R(x)?q(this,x,-1):m.bind(this)(x,v)}}}))})(St)),St.exports}var Es=Ms();const Is=$t(Es);var zt=(function(){var t=l(function(p,a,d,f){for(d=d||{},f=p.length;f--;d[p[f]]=a);return d},"o"),e=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],r=[1,26],s=[1,27],n=[1,28],y=[1,29],g=[1,30],T=[1,31],F=[1,32],L=[1,33],w=[1,34],N=[1,9],A=[1,10],R=[1,11],j=[1,12],V=[1,13],k=[1,14],E=[1,15],O=[1,16],$=[1,19],X=[1,20],q=[1,21],Y=[1,22],b=[1,23],h=[1,25],I=[1,35],m={trace:l(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:l(function(a,d,f,u,_,i,D){var o=i.length-1;switch(_){case 1:return i[o-1];case 2:this.$=[];break;case 3:i[o-1].push(i[o]),this.$=i[o-1];break;case 4:case 5:this.$=i[o];break;case 6:case 7:this.$=[];break;case 8:u.setWeekday("monday");break;case 9:u.setWeekday("tuesday");break;case 10:u.setWeekday("wednesday");break;case 11:u.setWeekday("thursday");break;case 12:u.setWeekday("friday");break;case 13:u.setWeekday("saturday");break;case 14:u.setWeekday("sunday");break;case 15:u.setWeekend("friday");break;case 16:u.setWeekend("saturday");break;case 17:u.setDateFormat(i[o].substr(11)),this.$=i[o].substr(11);break;case 18:u.enableInclusiveEndDates(),this.$=i[o].substr(18);break;case 19:u.TopAxis(),this.$=i[o].substr(8);break;case 20:u.setAxisFormat(i[o].substr(11)),this.$=i[o].substr(11);break;case 21:u.setTickInterval(i[o].substr(13)),this.$=i[o].substr(13);break;case 22:u.setExcludes(i[o].substr(9)),this.$=i[o].substr(9);break;case 23:u.setIncludes(i[o].substr(9)),this.$=i[o].substr(9);break;case 24:u.setTodayMarker(i[o].substr(12)),this.$=i[o].substr(12);break;case 27:u.setDiagramTitle(i[o].substr(6)),this.$=i[o].substr(6);break;case 28:this.$=i[o].trim(),u.setAccTitle(this.$);break;case 29:case 30:this.$=i[o].trim(),u.setAccDescription(this.$);break;case 31:u.addSection(i[o].substr(8)),this.$=i[o].substr(8);break;case 33:u.addTask(i[o-1],i[o]),this.$="task";break;case 34:this.$=i[o-1],u.setClickEvent(i[o-1],i[o],null);break;case 35:this.$=i[o-2],u.setClickEvent(i[o-2],i[o-1],i[o]);break;case 36:this.$=i[o-2],u.setClickEvent(i[o-2],i[o-1],null),u.setLink(i[o-2],i[o]);break;case 37:this.$=i[o-3],u.setClickEvent(i[o-3],i[o-2],i[o-1]),u.setLink(i[o-3],i[o]);break;case 38:this.$=i[o-2],u.setClickEvent(i[o-2],i[o],null),u.setLink(i[o-2],i[o-1]);break;case 39:this.$=i[o-3],u.setClickEvent(i[o-3],i[o-1],i[o]),u.setLink(i[o-3],i[o-2]);break;case 40:this.$=i[o-1],u.setLink(i[o-1],i[o]);break;case 41:case 47:this.$=i[o-1]+" "+i[o];break;case 42:case 43:case 45:this.$=i[o-2]+" "+i[o-1]+" "+i[o];break;case 44:case 46:this.$=i[o-3]+" "+i[o-2]+" "+i[o-1]+" "+i[o];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:r,13:s,14:n,15:y,16:g,17:T,18:F,19:18,20:L,21:w,22:N,23:A,24:R,25:j,26:V,27:k,28:E,29:O,30:$,31:X,33:q,35:Y,36:b,37:24,38:h,40:I},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:36,11:17,12:r,13:s,14:n,15:y,16:g,17:T,18:F,19:18,20:L,21:w,22:N,23:A,24:R,25:j,26:V,27:k,28:E,29:O,30:$,31:X,33:q,35:Y,36:b,37:24,38:h,40:I},t(e,[2,5]),t(e,[2,6]),t(e,[2,17]),t(e,[2,18]),t(e,[2,19]),t(e,[2,20]),t(e,[2,21]),t(e,[2,22]),t(e,[2,23]),t(e,[2,24]),t(e,[2,25]),t(e,[2,26]),t(e,[2,27]),{32:[1,37]},{34:[1,38]},t(e,[2,30]),t(e,[2,31]),t(e,[2,32]),{39:[1,39]},t(e,[2,8]),t(e,[2,9]),t(e,[2,10]),t(e,[2,11]),t(e,[2,12]),t(e,[2,13]),t(e,[2,14]),t(e,[2,15]),t(e,[2,16]),{41:[1,40],43:[1,41]},t(e,[2,4]),t(e,[2,28]),t(e,[2,29]),t(e,[2,33]),t(e,[2,34],{42:[1,42],43:[1,43]}),t(e,[2,40],{41:[1,44]}),t(e,[2,35],{43:[1,45]}),t(e,[2,36]),t(e,[2,38],{42:[1,46]}),t(e,[2,37]),t(e,[2,39])],defaultActions:{},parseError:l(function(a,d){if(d.recoverable)this.trace(a);else{var f=new Error(a);throw f.hash=d,f}},"parseError"),parse:l(function(a){var d=this,f=[0],u=[],_=[null],i=[],D=this.table,o="",H=0,c=0,S=2,C=1,P=i.slice.call(arguments,1),M=Object.create(this.lexer),z={yy:{}};for(var W in this.yy)Object.prototype.hasOwnProperty.call(this.yy,W)&&(z.yy[W]=this.yy[W]);M.setInput(a,z.yy),z.yy.lexer=M,z.yy.parser=this,typeof M.yylloc>"u"&&(M.yylloc={});var nt=M.yylloc;i.push(nt);var ot=M.options&&M.options.ranges;typeof z.yy.parseError=="function"?this.parseError=z.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function vt(Q){f.length=f.length-2*Q,_.length=_.length-Q,i.length=i.length-Q}l(vt,"popStack");function dt(){var Q;return Q=u.pop()||M.lex()||C,typeof Q!="number"&&(Q instanceof Array&&(u=Q,Q=u.pop()),Q=d.symbols_[Q]||Q),Q}l(dt,"lex");for(var B,K,Z,ct,J={},at,tt,ee,Tt;;){if(K=f[f.length-1],this.defaultActions[K]?Z=this.defaultActions[K]:((B===null||typeof B>"u")&&(B=dt()),Z=D[K]&&D[K][B]),typeof Z>"u"||!Z.length||!Z[0]){var Ft="";Tt=[];for(at in D[K])this.terminals_[at]&&at>S&&Tt.push("'"+this.terminals_[at]+"'");M.showPosition?Ft="Parse error on line "+(H+1)+`:
`+M.showPosition()+`
Expecting `+Tt.join(", ")+", got '"+(this.terminals_[B]||B)+"'":Ft="Parse error on line "+(H+1)+": Unexpected "+(B==C?"end of input":"'"+(this.terminals_[B]||B)+"'"),this.parseError(Ft,{text:M.match,token:this.terminals_[B]||B,line:M.yylineno,loc:nt,expected:Tt})}if(Z[0]instanceof Array&&Z.length>1)throw new Error("Parse Error: multiple actions possible at state: "+K+", token: "+B);switch(Z[0]){case 1:f.push(B),_.push(M.yytext),i.push(M.yylloc),f.push(Z[1]),B=null,c=M.yyleng,o=M.yytext,H=M.yylineno,nt=M.yylloc;break;case 2:if(tt=this.productions_[Z[1]][1],J.$=_[_.length-tt],J._$={first_line:i[i.length-(tt||1)].first_line,last_line:i[i.length-1].last_line,first_column:i[i.length-(tt||1)].first_column,last_column:i[i.length-1].last_column},ot&&(J._$.range=[i[i.length-(tt||1)].range[0],i[i.length-1].range[1]]),ct=this.performAction.apply(J,[o,c,H,z.yy,Z[1],_,i].concat(P)),typeof ct<"u")return ct;tt&&(f=f.slice(0,-1*tt*2),_=_.slice(0,-1*tt),i=i.slice(0,-1*tt)),f.push(this.productions_[Z[1]][0]),_.push(J.$),i.push(J._$),ee=D[f[f.length-2]][f[f.length-1]],f.push(ee);break;case 3:return!0}}return!0},"parse")},x=(function(){var p={EOF:1,parseError:l(function(d,f){if(this.yy.parser)this.yy.parser.parseError(d,f);else throw new Error(d)},"parseError"),setInput:l(function(a,d){return this.yy=d||this.yy||{},this._input=a,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:l(function(){var a=this._input[0];this.yytext+=a,this.yyleng++,this.offset++,this.match+=a,this.matched+=a;var d=a.match(/(?:\r\n?|\n).*/g);return d?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),a},"input"),unput:l(function(a){var d=a.length,f=a.split(/(?:\r\n?|\n)/g);this._input=a+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-d),this.offset-=d;var u=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),f.length-1&&(this.yylineno-=f.length-1);var _=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:f?(f.length===u.length?this.yylloc.first_column:0)+u[u.length-f.length].length-f[0].length:this.yylloc.first_column-d},this.options.ranges&&(this.yylloc.range=[_[0],_[0]+this.yyleng-d]),this.yyleng=this.yytext.length,this},"unput"),more:l(function(){return this._more=!0,this},"more"),reject:l(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:l(function(a){this.unput(this.match.slice(a))},"less"),pastInput:l(function(){var a=this.matched.substr(0,this.matched.length-this.match.length);return(a.length>20?"...":"")+a.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:l(function(){var a=this.match;return a.length<20&&(a+=this._input.substr(0,20-a.length)),(a.substr(0,20)+(a.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:l(function(){var a=this.pastInput(),d=new Array(a.length+1).join("-");return a+this.upcomingInput()+`
`+d+"^"},"showPosition"),test_match:l(function(a,d){var f,u,_;if(this.options.backtrack_lexer&&(_={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(_.yylloc.range=this.yylloc.range.slice(0))),u=a[0].match(/(?:\r\n?|\n).*/g),u&&(this.yylineno+=u.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:u?u[u.length-1].length-u[u.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+a[0].length},this.yytext+=a[0],this.match+=a[0],this.matches=a,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(a[0].length),this.matched+=a[0],f=this.performAction.call(this,this.yy,this,d,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),f)return f;if(this._backtrack){for(var i in _)this[i]=_[i];return!1}return!1},"test_match"),next:l(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var a,d,f,u;this._more||(this.yytext="",this.match="");for(var _=this._currentRules(),i=0;i<_.length;i++)if(f=this._input.match(this.rules[_[i]]),f&&(!d||f[0].length>d[0].length)){if(d=f,u=i,this.options.backtrack_lexer){if(a=this.test_match(f,_[i]),a!==!1)return a;if(this._backtrack){d=!1;continue}else return!1}else if(!this.options.flex)break}return d?(a=this.test_match(d,_[u]),a!==!1?a:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:l(function(){var d=this.next();return d||this.lex()},"lex"),begin:l(function(d){this.conditionStack.push(d)},"begin"),popState:l(function(){var d=this.conditionStack.length-1;return d>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:l(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:l(function(d){return d=this.conditionStack.length-1-Math.abs(d||0),d>=0?this.conditionStack[d]:"INITIAL"},"topState"),pushState:l(function(d){this.begin(d)},"pushState"),stateStackSize:l(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:l(function(d,f,u,_){switch(u){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return p})();m.lexer=x;function v(){this.yy={}}return l(v,"Parser"),v.prototype=m,m.Parser=v,new v})();zt.parser=zt;var Ys=zt;U.extend(ps);U.extend(bs);U.extend(Ss);var he={friday:5,saturday:6},et="",Bt="",Gt=void 0,jt="",yt=[],gt=[],Xt=new Map,Ut=[],It=[],pt="",Zt="",Ce=["active","done","crit","milestone","vert"],Qt=[],ft="",xt=!1,Kt=!1,Jt="sunday",Yt="saturday",Vt=0,$s=l(function(){Ut=[],It=[],pt="",Qt=[],Ct=0,qt=void 0,Mt=void 0,G=[],et="",Bt="",Zt="",Gt=void 0,jt="",yt=[],gt=[],xt=!1,Kt=!1,Vt=0,Xt=new Map,ft="",Be(),Jt="sunday",Yt="saturday"},"clear"),Fs=l(function(t){ft=t},"setDiagramId"),Ls=l(function(t){Bt=t},"setAxisFormat"),As=l(function(){return Bt},"getAxisFormat"),Os=l(function(t){Gt=t},"setTickInterval"),Ws=l(function(){return Gt},"getTickInterval"),Ns=l(function(t){jt=t},"setTodayMarker"),Ps=l(function(){return jt},"getTodayMarker"),Rs=l(function(t){et=t},"setDateFormat"),zs=l(function(){xt=!0},"enableInclusiveEndDates"),Vs=l(function(){return xt},"endDatesAreInclusive"),Hs=l(function(){Kt=!0},"enableTopAxis"),qs=l(function(){return Kt},"topAxisEnabled"),Bs=l(function(t){Zt=t},"setDisplayMode"),Gs=l(function(){return Zt},"getDisplayMode"),js=l(function(){return et},"getDateFormat"),Me=l((t,e)=>{const r=e.toLowerCase().split(/[\s,]+/).filter(s=>s!=="");return[...new Set([...t,...r])]},"mergeTokens"),Xs=l(function(t){yt=Me(yt,t)},"setIncludes"),Us=l(function(){return yt},"getIncludes"),Zs=l(function(t){gt=Me(gt,t)},"setExcludes"),Qs=l(function(){return gt},"getExcludes"),Ks=l(function(){return Xt},"getLinks"),Js=l(function(t){pt=t,Ut.push(t)},"addSection"),tr=l(function(){return Ut},"getSections"),er=l(function(){let t=me();const e=10;let r=0;for(;!t&&r<e;)t=me(),r++;return It=G,It},"getTasks"),Ee=l(function(t,e,r,s){const n=t.format(e.trim()),y=t.format("YYYY-MM-DD");return s.includes(n)||s.includes(y)?!1:r.includes("weekends")&&(t.isoWeekday()===he[Yt]||t.isoWeekday()===he[Yt]+1)||r.includes(t.format("dddd").toLowerCase())?!0:r.includes(n)||r.includes(y)},"isInvalidDate"),sr=l(function(t){Jt=t},"setWeekday"),rr=l(function(){return Jt},"getWeekday"),ir=l(function(t){Yt=t},"setWeekend"),Ie=l(function(t,e,r,s){if(!r.length||t.manualEndTime)return;let n;t.startTime instanceof Date?n=U(t.startTime):n=U(t.startTime,e,!0),n=n.add(1,"d");let y;t.endTime instanceof Date?y=U(t.endTime):y=U(t.endTime,e,!0);const[g,T]=nr(n,y,e,r,s);t.endTime=g.toDate(),t.renderEndTime=T},"checkTaskDates"),nr=l(function(t,e,r,s,n){let y=!1,g=null;const T=e.add(1e4,"d");for(;t<=e;){if(y||(g=e.toDate()),y=Ee(t,r,s,n),y&&(e=e.add(1,"d"),e>T))throw new Error("Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.");t=t.add(1,"d")}return[e,g]},"fixTaskDates"),Ht=l(function(t,e,r){if(r=r.trim(),l(T=>{const F=T.trim();return F==="x"||F==="X"},"isTimestampFormat")(e)&&/^\d+$/.test(r))return new Date(Number(r));const y=/^after\s+(?<ids>[\d\w- ]+)/.exec(r);if(y!==null){let T=null;for(const L of y.groups.ids.split(" ")){let w=ut(L);w!==void 0&&(!T||w.endTime>T.endTime)&&(T=w)}if(T)return T.endTime;const F=new Date;return F.setHours(0,0,0,0),F}let g=U(r,e.trim(),!0);if(g.isValid())return g.toDate();{lt.debug("Invalid date:"+r),lt.debug("With date format:"+e.trim());const T=new Date(r);if(T===void 0||isNaN(T.getTime())||T.getFullYear()<-1e4||T.getFullYear()>1e4)throw new Error("Invalid date:"+r);return T}},"getStartDate"),Ye=l(function(t){const e=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return e!==null?[Number.parseFloat(e[1]),e[2]]:[NaN,"ms"]},"parseDuration"),$e=l(function(t,e,r,s=!1){r=r.trim();const y=/^until\s+(?<ids>[\d\w- ]+)/.exec(r);if(y!==null){let w=null;for(const A of y.groups.ids.split(" ")){let R=ut(A);R!==void 0&&(!w||R.startTime<w.startTime)&&(w=R)}if(w)return w.startTime;const N=new Date;return N.setHours(0,0,0,0),N}let g=U(r,e.trim(),!0);if(g.isValid())return s&&(g=g.add(1,"d")),g.toDate();let T=U(t);const[F,L]=Ye(r);if(!Number.isNaN(F)){const w=T.add(F,L);w.isValid()&&(T=w)}return T.toDate()},"getEndDate"),Ct=0,kt=l(function(t){return t===void 0?(Ct=Ct+1,"task"+Ct):t},"parseId"),ar=l(function(t,e){let r;e.substr(0,1)===":"?r=e.substr(1,e.length):r=e;const s=r.split(","),n={};te(s,n,Ce);for(let g=0;g<s.length;g++)s[g]=s[g].trim();let y="";switch(s.length){case 1:n.id=kt(),n.startTime=t.endTime,y=s[0];break;case 2:n.id=kt(),n.startTime=Ht(void 0,et,s[0]),y=s[1];break;case 3:n.id=kt(s[0]),n.startTime=Ht(void 0,et,s[1]),y=s[2];break}return y&&(n.endTime=$e(n.startTime,et,y,xt),n.manualEndTime=U(y,"YYYY-MM-DD",!0).isValid(),Ie(n,et,gt,yt)),n},"compileData"),or=l(function(t,e){let r;e.substr(0,1)===":"?r=e.substr(1,e.length):r=e;const s=r.split(","),n={};te(s,n,Ce);for(let y=0;y<s.length;y++)s[y]=s[y].trim();switch(s.length){case 1:n.id=kt(),n.startTime={type:"prevTaskEnd",id:t},n.endTime={data:s[0]};break;case 2:n.id=kt(),n.startTime={type:"getStartDate",startData:s[0]},n.endTime={data:s[1]};break;case 3:n.id=kt(s[0]),n.startTime={type:"getStartDate",startData:s[1]},n.endTime={data:s[2]};break}return n},"parseData"),qt,Mt,G=[],Fe={},cr=l(function(t,e){const r={section:pt,type:pt,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:e},task:t,classes:[]},s=or(Mt,e);r.raw.startTime=s.startTime,r.raw.endTime=s.endTime,r.id=s.id,r.prevTaskId=Mt,r.active=s.active,r.done=s.done,r.crit=s.crit,r.milestone=s.milestone,r.vert=s.vert,r.vert?r.order=-1:(r.order=Vt,Vt++);const n=G.push(r);Mt=r.id,Fe[r.id]=n-1},"addTask"),ut=l(function(t){const e=Fe[t];return G[e]},"findTaskById"),lr=l(function(t,e){const r={section:pt,type:pt,description:t,task:t,classes:[]},s=ar(qt,e);r.startTime=s.startTime,r.endTime=s.endTime,r.id=s.id,r.active=s.active,r.done=s.done,r.crit=s.crit,r.milestone=s.milestone,r.vert=s.vert,qt=r,It.push(r)},"addTaskOrg"),me=l(function(){const t=l(function(r){const s=G[r];let n="";switch(G[r].raw.startTime.type){case"prevTaskEnd":{const y=ut(s.prevTaskId);s.startTime=y.endTime;break}case"getStartDate":n=Ht(void 0,et,G[r].raw.startTime.startData),n&&(G[r].startTime=n);break}return G[r].startTime&&(G[r].endTime=$e(G[r].startTime,et,G[r].raw.endTime.data,xt),G[r].endTime&&(G[r].processed=!0,G[r].manualEndTime=U(G[r].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),Ie(G[r],et,gt,yt))),G[r].processed},"compileTask");let e=!0;for(const[r,s]of G.entries())t(r),e=e&&s.processed;return e},"compileTasks"),ur=l(function(t,e){let r=e;ht().securityLevel!=="loose"&&(r=qe.sanitizeUrl(e)),t.split(",").forEach(function(s){ut(s)!==void 0&&(Ae(s,()=>{window.open(r,"_self")}),Xt.set(s,r))}),Le(t,"clickable")},"setLink"),Le=l(function(t,e){t.split(",").forEach(function(r){let s=ut(r);s!==void 0&&s.classes.push(e)})},"setClass"),dr=l(function(t,e,r){if(ht().securityLevel!=="loose"||e===void 0)return;let s=[];if(typeof r=="string"){s=r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let y=0;y<s.length;y++){let g=s[y].trim();g.startsWith('"')&&g.endsWith('"')&&(g=g.substr(1,g.length-2)),s[y]=g}}s.length===0&&s.push(t),ut(t)!==void 0&&Ae(t,()=>{Ge.runFunc(e,...s)})},"setClickFun"),Ae=l(function(t,e){Qt.push(function(){const r=ft?`${ft}-${t}`:t,s=document.querySelector(`[id="${r}"]`);s!==null&&s.addEventListener("click",function(){e()})},function(){const r=ft?`${ft}-${t}`:t,s=document.querySelector(`[id="${r}-text"]`);s!==null&&s.addEventListener("click",function(){e()})})},"pushFun"),fr=l(function(t,e,r){t.split(",").forEach(function(s){dr(s,e,r)}),Le(t,"clickable")},"setClickEvent"),hr=l(function(t){Qt.forEach(function(e){e(t)})},"bindFunctions"),mr={getConfig:l(()=>ht().gantt,"getConfig"),clear:$s,setDateFormat:Rs,getDateFormat:js,enableInclusiveEndDates:zs,endDatesAreInclusive:Vs,enableTopAxis:Hs,topAxisEnabled:qs,setAxisFormat:Ls,getAxisFormat:As,setTickInterval:Os,getTickInterval:Ws,setTodayMarker:Ns,getTodayMarker:Ps,setAccTitle:ze,getAccTitle:Re,setDiagramTitle:Pe,getDiagramTitle:Ne,setDiagramId:Fs,setDisplayMode:Bs,getDisplayMode:Gs,setAccDescription:We,getAccDescription:Oe,addSection:Js,getSections:tr,getTasks:er,addTask:cr,findTaskById:ut,addTaskOrg:lr,setIncludes:Xs,getIncludes:Us,setExcludes:Zs,getExcludes:Qs,setClickEvent:fr,setLink:ur,getLinks:Ks,bindFunctions:hr,parseDuration:Ye,isInvalidDate:Ee,setWeekday:sr,getWeekday:rr,setWeekend:ir};function te(t,e,r){let s=!0;for(;s;)s=!1,r.forEach(function(n){const y="^\\s*"+n+"\\s*$",g=new RegExp(y);t[0].match(g)&&(e[n]=!0,t.shift(1),s=!0)})}l(te,"getTaskTags");U.extend(Is);var kr=l(function(){lt.debug("Something is calling, setConf, remove the call")},"setConf"),ke={monday:ts,tuesday:Je,wednesday:Ke,thursday:Qe,friday:Ze,saturday:Ue,sunday:Xe},yr=l((t,e)=>{let r=[...t].map(()=>-1/0),s=[...t].sort((y,g)=>y.startTime-g.startTime||y.order-g.order),n=0;for(const y of s)for(let g=0;g<r.length;g++)if(y.startTime>=r[g]){r[g]=y.endTime,y.order=g+e,g>n&&(n=g);break}return n},"getMaxIntersections"),rt,Pt=1e4,gr=l(function(t,e,r,s){const n=ht().gantt;s.db.setDiagramId(e);const y=ht().securityLevel;let g;y==="sandbox"&&(g=bt("#i"+e));const T=y==="sandbox"?bt(g.nodes()[0].contentDocument.body):bt("body"),F=y==="sandbox"?g.nodes()[0].contentDocument:document,L=F.getElementById(e);rt=L.parentElement.offsetWidth,rt===void 0&&(rt=1200),n.useWidth!==void 0&&(rt=n.useWidth);const w=s.db.getTasks(),N=w.filter(m=>!m.vert);let A=[];for(const m of N)A.push(m.type);A=I(A);const R={};let j=2*n.topPadding;if(s.db.getDisplayMode()==="compact"||n.displayMode==="compact"){const m={};for(const v of N)m[v.section]===void 0?m[v.section]=[v]:m[v.section].push(v);let x=0;for(const v of Object.keys(m)){const p=yr(m[v],x)+1;x+=p,j+=p*(n.barHeight+n.barGap),R[v]=p}}else{j+=N.length*(n.barHeight+n.barGap);for(const m of A)R[m]=N.filter(x=>x.type===m).length}L.setAttribute("viewBox","0 0 "+rt+" "+j);const V=T.select(`[id="${e}"]`),k=je().domain([es(w,function(m){return m.startTime}),ss(w,function(m){return m.endTime})]).rangeRound([0,rt-n.leftPadding-n.rightPadding]);function E(m,x){const v=m.startTime,p=x.startTime;let a=0;return v>p?a=1:v<p&&(a=-1),a}l(E,"taskCompare"),w.sort(E),O(w,rt,j),Ve(V,j,rt,n.useMaxWidth),V.append("text").text(s.db.getDiagramTitle()).attr("x",rt/2).attr("y",n.titleTopMargin).attr("class","titleText");function O(m,x,v){const p=n.barHeight,a=p+n.barGap,d=n.topPadding,f=n.leftPadding,u=rs().domain([0,A.length]).range(["#00B9FA","#F95002"]).interpolate(ms);X(a,d,f,x,v,m,s.db.getExcludes(),s.db.getIncludes()),Y(f,d,x,v),$(m,a,d,f,p,u,x),b(a,d),h(f,d,x,v)}l(O,"makeGantt");function $(m,x,v,p,a,d,f){m.sort((c,S)=>c.vert===S.vert?0:c.vert?1:-1);const u=m.filter(c=>!c.vert),i=[...new Set(u.map(c=>c.order))].map(c=>u.find(S=>S.order===c));V.append("g").selectAll("rect").data(i).enter().append("rect").attr("x",0).attr("y",function(c,S){return S=c.order,S*x+v-2}).attr("width",function(){return f-n.rightPadding/2}).attr("height",x).attr("class",function(c){for(const[S,C]of A.entries())if(c.type===C)return"section section"+S%n.numberSectionStyles;return"section section0"}).enter();const D=V.append("g").selectAll("rect").data(m).enter(),o=s.db.getLinks();if(D.append("rect").attr("id",function(c){return e+"-"+c.id}).attr("rx",3).attr("ry",3).attr("x",function(c){return c.milestone?k(c.startTime)+p+.5*(k(c.endTime)-k(c.startTime))-.5*a:k(c.startTime)+p}).attr("y",function(c,S){return S=c.order,c.vert?n.gridLineStartPadding:S*x+v}).attr("width",function(c){return c.milestone?a:c.vert?.08*a:k(c.renderEndTime||c.endTime)-k(c.startTime)}).attr("height",function(c){return c.vert?u.length*(n.barHeight+n.barGap)+n.barHeight*2:a}).attr("transform-origin",function(c,S){return S=c.order,(k(c.startTime)+p+.5*(k(c.endTime)-k(c.startTime))).toString()+"px "+(S*x+v+.5*a).toString()+"px"}).attr("class",function(c){const S="task";let C="";c.classes.length>0&&(C=c.classes.join(" "));let P=0;for(const[z,W]of A.entries())c.type===W&&(P=z%n.numberSectionStyles);let M="";return c.active?c.crit?M+=" activeCrit":M=" active":c.done?c.crit?M=" doneCrit":M=" done":c.crit&&(M+=" crit"),M.length===0&&(M=" task"),c.milestone&&(M=" milestone "+M),c.vert&&(M=" vert "+M),M+=P,M+=" "+C,S+M}),D.append("text").attr("id",function(c){return e+"-"+c.id+"-text"}).text(function(c){return c.task}).attr("font-size",n.fontSize).attr("x",function(c){let S=k(c.startTime),C=k(c.renderEndTime||c.endTime);if(c.milestone&&(S+=.5*(k(c.endTime)-k(c.startTime))-.5*a,C=S+a),c.vert)return k(c.startTime)+p;const P=this.getBBox().width;return P>C-S?C+P+1.5*n.leftPadding>f?S+p-5:C+p+5:(C-S)/2+S+p}).attr("y",function(c,S){return c.vert?n.gridLineStartPadding+u.length*(n.barHeight+n.barGap)+60:(S=c.order,S*x+n.barHeight/2+(n.fontSize/2-2)+v)}).attr("text-height",a).attr("class",function(c){const S=k(c.startTime);let C=k(c.endTime);c.milestone&&(C=S+a);const P=this.getBBox().width;let M="";c.classes.length>0&&(M=c.classes.join(" "));let z=0;for(const[nt,ot]of A.entries())c.type===ot&&(z=nt%n.numberSectionStyles);let W="";return c.active&&(c.crit?W="activeCritText"+z:W="activeText"+z),c.done?c.crit?W=W+" doneCritText"+z:W=W+" doneText"+z:c.crit&&(W=W+" critText"+z),c.milestone&&(W+=" milestoneText"),c.vert&&(W+=" vertText"),P>C-S?C+P+1.5*n.leftPadding>f?M+" taskTextOutsideLeft taskTextOutside"+z+" "+W:M+" taskTextOutsideRight taskTextOutside"+z+" "+W+" width-"+P:M+" taskText taskText"+z+" "+W+" width-"+P}),ht().securityLevel==="sandbox"){let c;c=bt("#i"+e);const S=c.nodes()[0].contentDocument;D.filter(function(C){return o.has(C.id)}).each(function(C){var P=S.querySelector("#"+CSS.escape(e+"-"+C.id)),M=S.querySelector("#"+CSS.escape(e+"-"+C.id+"-text"));const z=P.parentNode;var W=S.createElement("a");W.setAttribute("xlink:href",o.get(C.id)),W.setAttribute("target","_top"),z.appendChild(W),W.appendChild(P),W.appendChild(M)})}}l($,"drawRects");function X(m,x,v,p,a,d,f,u){if(f.length===0&&u.length===0)return;let _,i;for(const{startTime:C,endTime:P}of d)(_===void 0||C<_)&&(_=C),(i===void 0||P>i)&&(i=P);if(!_||!i)return;if(U(i).diff(U(_),"year")>5){lt.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}const D=s.db.getDateFormat(),o=[];let H=null,c=U(_);for(;c.valueOf()<=i;)s.db.isInvalidDate(c,D,f,u)?H?H.end=c:H={start:c,end:c}:H&&(o.push(H),H=null),c=c.add(1,"d");V.append("g").selectAll("rect").data(o).enter().append("rect").attr("id",C=>e+"-exclude-"+C.start.format("YYYY-MM-DD")).attr("x",C=>k(C.start.startOf("day"))+v).attr("y",n.gridLineStartPadding).attr("width",C=>k(C.end.endOf("day"))-k(C.start.startOf("day"))).attr("height",a-x-n.gridLineStartPadding).attr("transform-origin",function(C,P){return(k(C.start)+v+.5*(k(C.end)-k(C.start))).toString()+"px "+(P*m+.5*a).toString()+"px"}).attr("class","exclude-range")}l(X,"drawExcludeDays");function q(m,x,v,p){if(v<=0||m>x)return 1/0;const a=x-m,d=U.duration({[p??"day"]:v}).asMilliseconds();return d<=0?1/0:Math.ceil(a/d)}l(q,"getEstimatedTickCount");function Y(m,x,v,p){const a=s.db.getDateFormat(),d=s.db.getAxisFormat();let f;d?f=d:a==="D"?f="%d":f=n.axisFormat??"%Y-%m-%d";let u=as(k).tickSize(-p+x+n.gridLineStartPadding).tickFormat(se(f));const i=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(s.db.getTickInterval()||n.tickInterval);if(i!==null){const D=parseInt(i[1],10);if(isNaN(D)||D<=0)lt.warn(`Invalid tick interval value: "${i[1]}". Skipping custom tick interval.`);else{const o=i[2],H=s.db.getWeekday()||n.weekday,c=k.domain(),S=c[0],C=c[1],P=q(S,C,D,o);if(P>Pt)lt.warn(`The tick interval "${D}${o}" would generate ${P} ticks, which exceeds the maximum allowed (${Pt}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(o){case"millisecond":u.ticks(ce.every(D));break;case"second":u.ticks(oe.every(D));break;case"minute":u.ticks(ae.every(D));break;case"hour":u.ticks(ne.every(D));break;case"day":u.ticks(ie.every(D));break;case"week":u.ticks(ke[H].every(D));break;case"month":u.ticks(re.every(D));break}}}if(V.append("g").attr("class","grid").attr("transform","translate("+m+", "+(p-50)+")").call(u).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),s.db.topAxisEnabled()||n.topAxis){let D=os(k).tickSize(-p+x+n.gridLineStartPadding).tickFormat(se(f));if(i!==null){const o=parseInt(i[1],10);if(isNaN(o)||o<=0)lt.warn(`Invalid tick interval value: "${i[1]}". Skipping custom tick interval.`);else{const H=i[2],c=s.db.getWeekday()||n.weekday,S=k.domain(),C=S[0],P=S[1];if(q(C,P,o,H)<=Pt)switch(H){case"millisecond":D.ticks(ce.every(o));break;case"second":D.ticks(oe.every(o));break;case"minute":D.ticks(ae.every(o));break;case"hour":D.ticks(ne.every(o));break;case"day":D.ticks(ie.every(o));break;case"week":D.ticks(ke[c].every(o));break;case"month":D.ticks(re.every(o));break}}}V.append("g").attr("class","grid").attr("transform","translate("+m+", "+x+")").call(D).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}l(Y,"makeGrid");function b(m,x){let v=0;const p=Object.keys(R).map(a=>[a,R[a]]);V.append("g").selectAll("text").data(p).enter().append(function(a){const d=a[0].split(He.lineBreakRegex),f=-(d.length-1)/2,u=F.createElementNS("http://www.w3.org/2000/svg","text");u.setAttribute("dy",f+"em");for(const[_,i]of d.entries()){const D=F.createElementNS("http://www.w3.org/2000/svg","tspan");D.setAttribute("alignment-baseline","central"),D.setAttribute("x","10"),_>0&&D.setAttribute("dy","1em"),D.textContent=i,u.appendChild(D)}return u}).attr("x",10).attr("y",function(a,d){if(d>0)for(let f=0;f<d;f++)return v+=p[d-1][1],a[1]*m/2+v*m+x;else return a[1]*m/2+x}).attr("font-size",n.sectionFontSize).attr("class",function(a){for(const[d,f]of A.entries())if(a[0]===f)return"sectionTitle sectionTitle"+d%n.numberSectionStyles;return"sectionTitle"})}l(b,"vertLabels");function h(m,x,v,p){const a=s.db.getTodayMarker();if(a==="off")return;const d=V.append("g").attr("class","today"),f=new Date,u=d.append("line");u.attr("x1",k(f)+m).attr("x2",k(f)+m).attr("y1",n.titleTopMargin).attr("y2",p-n.titleTopMargin).attr("class","today"),a!==""&&u.attr("style",a.replace(/,/g,";"))}l(h,"drawToday");function I(m){const x={},v=[];for(let p=0,a=m.length;p<a;++p)Object.prototype.hasOwnProperty.call(x,m[p])||(x[m[p]]=!0,v.push(m[p]));return v}l(I,"checkUnique")},"draw"),pr={setConf:kr,draw:gr},vr=l(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done task text displayed outside the bar sits against the diagram background,
     not against the done-task bar, so it must use the outside/contrast color. */
  .doneText0.taskTextOutsideLeft,
  .doneText0.taskTextOutsideRight,
  .doneText1.taskTextOutsideLeft,
  .doneText1.taskTextOutsideRight,
  .doneText2.taskTextOutsideLeft,
  .doneText2.taskTextOutsideRight,
  .doneText3.taskTextOutsideLeft,
  .doneText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done-crit task text outside the bar — same reasoning as doneText above. */
  .doneCritText0.taskTextOutsideLeft,
  .doneCritText0.taskTextOutsideRight,
  .doneCritText1.taskTextOutsideLeft,
  .doneCritText1.taskTextOutsideRight,
  .doneCritText2.taskTextOutsideLeft,
  .doneCritText2.taskTextOutsideRight,
  .doneCritText3.taskTextOutsideLeft,
  .doneCritText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles"),xr=vr,Lr={parser:Ys,db:mr,renderer:pr,styles:xr};export{Lr as diagram};
